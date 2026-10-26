import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleDestroy,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { ApiError } from "../api-error";
import {
  MemoryRateLimitStore,
  RateLimitResult,
  RateLimitStore,
  RedisRateLimitStore,
  rateLimitKey,
} from "./rate-limit-store";

export const RATE_LIMIT_KEY = "ib:rate-limit";

export interface RateLimitOptions {
  /** Number of requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds (default: one minute). */
  windowMs?: number;
  /** Bucket by IP + submitted email instead of IP only (login/registration). */
  perEmail?: boolean;
  /** Stable bucket name; defaults to the controller + handler. */
  name?: string;
}

/**
 * Declare a per-route limit. Routes without the decorator fall back to the
 * global limit (`RATE_LIMIT_GLOBAL`, default 1200 requests/minute per IP).
 */
export function RateLimit(options: RateLimitOptions) {
  return SetMetadata(RATE_LIMIT_KEY, options);
}

function enabled() {
  return process.env.RATE_LIMIT_ENABLED !== "false";
}

function globalLimit() {
  const parsed = Number(process.env.RATE_LIMIT_GLOBAL ?? 1200);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1200;
}

/**
 * Fixed-window limiter.
 *
 * With `REDIS_URL` set, counters live in Redis so every API replica sees the
 * same bucket. If Redis is unreachable the guard falls back to a per-process
 * map (availability over strictness) and logs a warning at most once a minute.
 * Without `REDIS_URL` (local tests, prototypes) the map is the only store.
 */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly memory = new MemoryRateLimitStore();
  private redis?: RedisRateLimitStore;
  private lastFallbackLog = 0;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!enabled()) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const windowMs = route?.windowMs ?? 60_000;
    const limit = route?.limit ?? globalLimit();
    const identity = route?.perEmail
      ? `${clientIp(request)}:${String((request.body as { email?: unknown })?.email ?? "").toLowerCase()}`
      : clientIp(request);
    const bucketName =
      route?.name ?? `${context.getClass().name}.${context.getHandler().name}`;
    const key = rateLimitKey(bucketName, identity);

    let result: RateLimitResult;
    try {
      result = await (await this.store()).increment(key, windowMs);
    } catch (error) {
      this.logFallback(error);
      result = await this.memory.increment(key, windowMs);
    }

    if (result.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      response.setHeader("Retry-After", String(retryAfter));
      throw new ApiError(
        "RATE_LIMITED",
        "Too many requests. Please wait a moment and try again.",
        429,
        { retryAfter },
      );
    }

    return true;
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  /**
   * Lazily create the Redis client so test suites that never enable rate
   * limiting do not open sockets. The first hit waits briefly for the socket;
   * if Redis is down, the guard catches the error and uses memory.
   */
  private async store(): Promise<RateLimitStore> {
    const url = process.env.REDIS_URL;
    if (!url) return this.memory;
    if (!this.redis) {
      try {
        this.redis = new RedisRateLimitStore(url, {
          onError: (error) => this.logFallback(error),
        });
        this.logger.log(`Rate limiting shared through Redis (${safeHost(url)})`);
      } catch (error) {
        this.logFallback(error);
        return this.memory;
      }
    }
    await this.redis.ready(1_000);
    return this.redis;
  }

  private logFallback(error: unknown) {
    const now = Date.now();
    if (now - this.lastFallbackLog < 60_000) return;
    this.lastFallbackLog = now;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Redis rate-limit store unavailable (${message}); using per-instance memory fallback.`,
    );
  }
}

function clientIp(request: Request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "configured Redis";
  }
}
