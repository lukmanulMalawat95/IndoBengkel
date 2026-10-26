import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CurrentUser } from "../common/auth/current-user.decorator";

@Controller("service-orders")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return { data: await this.bookings.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.bookings.create(user.id, user, body) };
  }

  @Get(":id")
  async get(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.bookings.get(user.id, user, id) };
  }

  @Post(":id/cancel")
  async cancel(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.bookings.cancel(user.id, user, id) };
  }

  @Post(":id/approve-estimate")
  async approveEstimate(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.bookings.approveEstimate(user.id, id) };
  }

  @Post(":id/reject-estimate")
  async rejectEstimate(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.bookings.rejectEstimate(user.id, id) };
  }

  @Post(":id/pay")
  async pay(@CurrentUser() user: any, @Param("id") id: string, @Body() body: { method?: string }) {
    return { data: await this.bookings.pay(user.id, id, String(body.method ?? "qris")) };
  }

  @Post(":id/simulate-paid")
  async simulatePaid(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.bookings.simulatePaid(user.id, id) };
  }
}
