import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../api-error";
import { SESSION_COOKIE } from "../auth/session.guard";
import { csrfCookieOptions } from "./cookies";

export const CSRF_COOKIE = "ib_csrf";
export const CSRF_HEADER = "x-csrf-token";
export const SKIP_CSRF_KEY = "ib:skip-csrf";

/**
 * Bootstrap endpoints (sign-in, registration, password reset) must stay
 * reachable even if the browser still carries an expired session cookie.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export function csrfEnabled() {
  return process.env.CSRF_ENABLED !== "false";
}

/**
 * Issue a CSRF token on the first response of a browsing session. Because the
 * cookie is not httpOnly the SPA can read it and mirror it into a header.
 */
export function csrfCookieMiddleware(request: Request, response: Response, next: NextFunction) {
  if (!csrfEnabled()) return next();

  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  if (!cookies) return next();

  const existing = cookies[CSRF_COOKIE];
  if (existing) return next();

  const token = randomBytes(32).toString("hex");
  response.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  cookies[CSRF_COOKIE] = token;
  next();
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit cookie guard for authenticated state changes.
 *
 * Requests without a session cookie are left to the route (login, registration,
 * password reset) — they cannot be ridden by a third-party page because there is
 * no ambient credential to abuse. Every authenticated mutation, including
 * logout and purchases, must echo the `ib_csrf` cookie in `X-CSRF-Token`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!csrfEnabled()) return true;

    const skipped = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipped) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (!request.cookies?.[SESSION_COOKIE]) return true;

    const expected = request.cookies?.[CSRF_COOKIE];
    const provided = request.get(CSRF_HEADER);
    if (
      expected &&
      provided &&
      expected.length === provided.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      return true;
    }

    throw new ApiError(
      "CSRF_TOKEN_INVALID",
      "Your security token expired. Refresh the page and try again.",
      403,
    );
  }
}
