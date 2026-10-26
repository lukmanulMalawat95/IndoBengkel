import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { RateLimit } from "../common/security/rate-limit";

@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get("conversations")
  async listConversations(
    @CurrentUser() user: any,
    @Query("scope") scope: "customer" | "workshop" = "customer",
  ) {
    return { data: await this.messaging.listConversations(user, scope) };
  }

  @RateLimit({ limit: 10 })
  @Post("conversations")
  async startConversation(@CurrentUser() user: any, @Body() body: { workshopId?: string }) {
    return { data: await this.messaging.startConversation(user, String(body.workshopId ?? "")) };
  }

  @Get("conversations/:id")
  async getConversation(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.messaging.getConversation(user, id) };
  }

  @RateLimit({ limit: 30 })
  @Post("conversations/:id/messages")
  async sendMessage(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { body?: string; attachmentUrl?: string },
  ) {
    return {
      data: await this.messaging.sendMessage(
        user,
        id,
        String(body.body ?? ""),
        body.attachmentUrl,
      ),
    };
  }

  @Post("conversations/:id/read")
  async markRead(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.messaging.markConversationRead(user, id) };
  }

  @Get("notifications")
  async listNotifications(@CurrentUser() user: any) {
    return { data: await this.messaging.listNotifications(user.id) };
  }

  @Post("notifications/read-all")
  async markAllRead(@CurrentUser() user: any) {
    return { data: await this.messaging.markAllNotificationsRead(user.id) };
  }

  @Post("notifications/:id/read")
  async markNotificationRead(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.messaging.markNotificationRead(user.id, id) };
  }
}
