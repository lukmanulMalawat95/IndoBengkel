import { Body, Controller, Get, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Public } from "../common/auth/public.decorator";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { SESSION_COOKIE } from "../common/auth/session.guard";
import { ApiError } from "../common/api-error";
import { SESSION_MAX_AGE_MS, sessionCookieOptions } from "../common/security/cookies";
import { SkipCsrf } from "../common/security/csrf";
import { RateLimit } from "../common/security/rate-limit";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 10, perEmail: true })
  @Post("auth/login")
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body);
    response.cookie(SESSION_COOKIE, result.token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_MS,
    });
    return { data: result.user };
  }

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 10, perEmail: true })
  @Post("auth/register/customer")
  async registerCustomer(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.registerCustomer(body);
    response.cookie(SESSION_COOKIE, result.token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_MS,
    });
    return { data: result.user };
  }

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 10, perEmail: true })
  @Post("auth/register/workshop")
  async registerWorkshop(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.registerWorkshop(body);
    response.cookie(SESSION_COOKIE, result.token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_MS,
    });
    return { data: result.user };
  }

  @Get("auth/me")
  async me(@CurrentUser() user: any) {
    return { data: await this.auth.me(user.id) };
  }

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 20 })
  @Post("auth/verify-email")
  async verifyEmail(@Body() body: { userId?: string }) {
    return { data: await this.auth.verifyEmail(String(body.userId ?? "")) };
  }

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 5, perEmail: true })
  @Post("auth/forgot-password")
  async forgotPassword(@Body() body: { email?: string }) {
    // Demo mailer: never reveal whether an address exists.
    void body;
    return { data: { ok: true } };
  }

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 10 })
  @Post("auth/reset-password")
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    if (!body.token || String(body.password ?? "").length < 8) {
      throw new ApiError("VALIDATION_ERROR", "A reset token and a password of 8+ characters are required.", 422);
    }
    // The demo build has no email delivery; the endpoint keeps the contract ready.
    return { data: { ok: true } };
  }

  @Public()
  @Post("auth/logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE]);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    return { data: { ok: true } };
  }

  @Get("auth/refresh")
  async refresh(@Req() request: Request) {
    return { data: await this.auth.refresh(request.cookies?.[SESSION_COOKIE]) };
  }

  @Patch("me/locale")
  async updateLocale(@CurrentUser() user: any, @Body() body: { locale?: string }) {
    return { data: await this.auth.updateLocale(user.id, String(body.locale ?? "")) };
  }
}
