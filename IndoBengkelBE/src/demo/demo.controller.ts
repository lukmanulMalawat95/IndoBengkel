import { Controller, Post } from "@nestjs/common";
import { DemoService } from "./demo.service";
import { Public } from "../common/auth/public.decorator";
import { SkipCsrf } from "../common/security/csrf";
import { RateLimit } from "../common/security/rate-limit";

@Controller("demo")
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Public()
  @SkipCsrf()
  @RateLimit({ limit: 3 })
  @Post("reset")
  async reset() {
    return { data: await this.demo.reset() };
  }
}
