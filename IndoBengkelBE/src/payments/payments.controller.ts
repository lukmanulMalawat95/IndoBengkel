import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Public } from "../common/auth/public.decorator";
import { SkipCsrf } from "../common/security/csrf";
import { RateLimit } from "../common/security/rate-limit";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Midtrans calls this endpoint server-to-server. It has no browser session,
   * so it is public and exempt from CSRF; the provider verifies the SHA512
   * signature before the payment service changes any state.
   */
  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 600, name: "midtrans-notification" })
  @HttpCode(HttpStatus.OK)
  @Post("midtrans/notification")
  async midtransNotification(@Body() body: unknown) {
    return { data: await this.payments.handleNotification(body) };
  }
}
