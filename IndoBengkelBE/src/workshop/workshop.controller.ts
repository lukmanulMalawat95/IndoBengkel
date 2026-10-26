import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { WorkshopService } from "./workshop.service";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { RateLimit } from "../common/security/rate-limit";

@Controller("workshop")
export class WorkshopController {
  constructor(private readonly workshop: WorkshopService) {}

  @Get("me")
  async me(@CurrentUser() user: any) {
    return { data: await this.workshop.me(user) };
  }

  @Patch("me")
  async updateMe(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.workshop.updateMe(user, body) };
  }

  @Get("dashboard")
  async dashboard(@CurrentUser() user: any) {
    return { data: await this.workshop.dashboard(user) };
  }

  // mechanics
  @Get("mechanics")
  async listMechanics(@CurrentUser() user: any) {
    return { data: await this.workshop.listMechanics(user) };
  }

  @Post("mechanics")
  async createMechanic(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.workshop.createMechanic(user, body) };
  }

  @Patch("mechanics/:id")
  async updateMechanic(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.workshop.updateMechanic(user, id, body) };
  }

  @Delete("mechanics/:id")
  async deleteMechanic(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.deleteMechanic(user, id) };
  }

  // services
  @Get("services")
  async listServices(@CurrentUser() user: any) {
    return { data: await this.workshop.listServices(user) };
  }

  @Post("services")
  async createService(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.workshop.createService(user, body) };
  }

  @Patch("services/:id")
  async updateService(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.workshop.updateService(user, id, body) };
  }

  @Delete("services/:id")
  async deleteService(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.deleteService(user, id) };
  }

  // products
  @Get("products")
  async listProducts(@CurrentUser() user: any) {
    return { data: await this.workshop.listProducts(user) };
  }

  @Post("products")
  async createProduct(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.workshop.createProduct(user, body) };
  }

  @Patch("products/:id")
  async updateProduct(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.workshop.updateProduct(user, id, body) };
  }

  @Delete("products/:id")
  async deleteProduct(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.deleteProduct(user, id) };
  }

  // bookings
  @Get("bookings")
  async listBookings(@CurrentUser() user: any, @Query("status") status?: string) {
    return { data: await this.workshop.listBookings(user, status) };
  }

  @Post("bookings/:id/confirm")
  async confirmBooking(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { estimatedTotal?: number },
  ) {
    return { data: await this.workshop.confirmBooking(user, id, Number(body.estimatedTotal)) };
  }

  @Post("bookings/:id/decline")
  async declineBooking(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return { data: await this.workshop.declineBooking(user, id, String(body.reason ?? "")) };
  }

  @Post("bookings/:id/no-show")
  async markNoShow(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.markNoShow(user, id) };
  }

  @Post("service-orders/:id/start")
  async startService(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { odometerIn?: number; mechanicIds?: string[] },
  ) {
    return {
      data: await this.workshop.startService(
        user,
        id,
        Number(body.odometerIn),
        body.mechanicIds ?? [],
      ),
    };
  }

  @Post("service-orders/:id/complete")
  async completeService(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.workshop.completeService(user, id, body) };
  }

  @Post("service-orders/:id/cash-paid")
  async markCashPaid(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.markCashPaid(user, id) };
  }

  // orders
  @Get("orders")
  async listOrders(@CurrentUser() user: any, @Query("status") status?: string) {
    return { data: await this.workshop.listOrders(user, status) };
  }

  @Post("orders/:id/preparing")
  async markPreparing(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.markPreparing(user, id) };
  }

  @Post("orders/:id/ready")
  async markReady(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.workshop.markReady(user, id) };
  }

  @Post("orders/:id/ship")
  async shipOrder(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { trackingNumber?: string },
  ) {
    return { data: await this.workshop.shipOrder(user, id, String(body.trackingNumber ?? "")) };
  }

  @Post("orders/:id/verify-pickup")
  async verifyPickup(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { pickupCode?: string },
  ) {
    return { data: await this.workshop.verifyPickup(user, id, String(body.pickupCode ?? "")) };
  }

  // reviews
  @Get("reviews")
  async listReviews(@CurrentUser() user: any) {
    return { data: await this.workshop.listReviews(user) };
  }

  @RateLimit({ limit: 20 })
  @Post("reviews/:id/reply")
  async replyReview(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { body?: string },
  ) {
    return { data: await this.workshop.replyReview(user, id, String(body.body ?? "")) };
  }
}
