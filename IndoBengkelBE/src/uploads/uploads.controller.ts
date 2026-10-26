import { Body, Controller, Post } from "@nestjs/common";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  async register(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.uploads.register(user.id, body) };
  }
}
