import { createHash } from "node:crypto";
import { Redis } from "ioredis";

export interface RateLimitResult {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}

/**
 * Process-local fixed-window store. Used when Redis is not configured and as
 * the fallback when Redis is temporarily unreachable.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitResult>();
  private lastSweep = Date.now();

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    return { ...bucket };
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/**
 * Atomic fixed-window increment. `INCR` + first-hit `PEXPIRE` in one script
 * prevents a key from being created without a TTL when two API instances race.
 */
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export interface RedisRateLimitStoreOptions {
  /** Called for connection/command errors; must not throw. */
  onError?: (error: unknown) => void;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: Redis;

  constructor(url: string, options: RedisRateLimitStoreOptions = {}) {
    this.client = new Redis(url, {
      // Never buffer commands while disconnected: a request should fall back to
      // memory immediately instead of waiting for a reconnect.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 500,
      connectTimeout: 1_000,
      retryStrategy: (attempt) => Math.min(250 * 2 ** Math.min(attempt, 4), 5_000),
    });
    this.client.on("error", (error) => options.onError?.(error));
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const [count, ttl] = (await this.client.eval(
      INCREMENT_SCRIPT,
      1,
      key,
      String(windowMs),
    )) as [number, number];

    const safeTtl = Number(ttl) > 0 ? Number(ttl) : windowMs;
    return { count: Number(count), resetAt: Date.now() + safeTtl };
  }

  /**
   * Wait for the connection before the first command. Without this, the very
   * first request after boot would fall back to memory while the socket is
   * still connecting, so one hit would not be counted in the shared bucket.
   */
  async ready(timeoutMs: number): Promise<void> {
    const status = this.client.status;
    if (status === "ready") return;
    // Only the initial connection is worth waiting for. While ioredis is
    // reconnecting, fail fast so requests do not each pay the timeout; the
    // background retry promotes the client back to "ready" when Redis returns.
    if (status !== "wait" && status !== "connecting" && status !== "connect") {
      throw new Error(`Redis is ${status}`);
    }

    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        this.client.off("ready", onReady);
        this.client.off("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = (error: Error) => finish(error);
      const timer = setTimeout(
        () => finish(new Error("Redis connection is not ready")),
        timeoutMs,
      );

      this.client.once("ready", onReady);
      this.client.once("error", onError);
      if (this.client.status === "wait") void this.client.connect().catch(() => undefined);
    });
  }

  async quit() {
    // Counters are ephemeral, so a graceful QUIT is not worth waiting for a
    // reconnect. Clearing the socket timeout and disconnecting releases the
    // timers that would otherwise keep short-lived processes awake.
    this.client.stream?.setTimeout(0);
    this.client.disconnect(false);
  }
}

/**
 * Keys are shared across instances but must not leak emails or other PII into
 * Redis. The bucket name stays readable; only the identity is hashed.
 */
export function rateLimitKey(bucket: string, identity: string) {
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `ib:ratelimit:${bucket}:${digest}`;
}
