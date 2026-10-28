import type { CookieOptions } from "express";

/**
 * Session cookie lifetime. The session row in PostgreSQL is the source of
 * truth; the cookie is only a transport for its random id.
 */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookies can only be marked `Secure` when the app is served over HTTPS.
 * The local Docker stack runs on http://localhost, so this stays opt-in instead
 * of keying off NODE_ENV (the image sets NODE_ENV=production).
 */
export function secureCookies() {
  return process.env.COOKIE_SECURE === "true";
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
  };
}

/**
 * The CSRF token must be readable by the browser so the SPA can echo it in
 * `X-CSRF-Token`; the double-submit check happens on the server.
 */
export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
  };
}
