import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { csrfCookieMiddleware } from "./common/security/csrf";
import { secureCookies } from "./common/security/cookies";

/**
 * Shared HTTP wiring for the real server and the test harness.
 * Keeping it in one place means e2e tests exercise the same middleware,
 * prefix, filters and CORS settings that production uses.
 */
export function configureApp(app: INestApplication): INestApplication {
  const express = app.getHttpAdapter().getInstance();
  if (process.env.TRUST_PROXY === "true") {
    express.set("trust proxy", 1);
  }

  app.use(
    helmet({
      // The API only returns JSON; the SPA owns the document policy.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // HSTS only makes sense once the deployment terminates TLS.
      hsts: secureCookies() ? undefined : false,
    }),
  );
  app.use(cookieParser());
  app.use(csrfCookieMiddleware);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    maxAge: 600,
  });
  return app;
}
