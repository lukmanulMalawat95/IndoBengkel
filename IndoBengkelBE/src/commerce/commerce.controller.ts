import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CommerceService } from "./commerce.service";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { RateLimit } from "../common/security/rate-limit";

@Controller()
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get("cart")
  async listCarts(@CurrentUser() user: any) {
    return { data: await this.commerce.listCarts(user.id) };
  }

  @Post("cart/items")
  async addToCart(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.commerce.addToCart(user.id, body) };
  }

  @Patch("cart/items/:id")
  async updateCartItem(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { qty?: number },
  ) {
    return { data: await this.commerce.updateCartItem(user.id, id, Number(body.qty)) };
  }

  @Delete("cart/items/:id")
  async removeCartItem(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.commerce.removeCartItem(user.id, id) };
  }

  @Delete("cart")
  async clearCart(@CurrentUser() user: any, @Query("workshopId") workshopId: string) {
    return { data: await this.commerce.clearCart(user.id, workshopId) };
  }

  @Post("orders")
  async createOrder(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.commerce.createOrder(user.id, user, body) };
  }

  @Get("orders")
  async listOrders(@CurrentUser() user: any) {
    return { data: await this.commerce.listOrders(user.id) };
  }

  @Get("orders/:id")
  async getOrder(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.commerce.getOrder(user.id, user, id) };
  }

  @Post("orders/:id/cancel")
  async cancelOrder(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.commerce.cancelOrder(user.id, id) };
  }

  @Post("orders/:id/pay")
  async payOrder(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.commerce.simulateOrderPayment(user.id, user, id) };
  }

  @Post("orders/:id/confirm-delivery")
  async confirmDelivery(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.commerce.confirmDelivery(user.id, id) };
  }

  @RateLimit({ limit: 10 })
  @Post("reviews/product")
  async reviewProduct(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.commerce.reviewProduct(user.id, body) };
  }

  @RateLimit({ limit: 10 })
  @Post("reviews/workshop")
  async reviewWorkshop(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.commerce.reviewWorkshop(user.id, body) };
  }
}
