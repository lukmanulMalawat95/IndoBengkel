import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { clamp, randomCode, uid } from "../common/ids";
import { courierById, shippingCostFor, totalWeight } from "../common/shipping";
import { PaymentsService } from "../payments/payments.service";
import { isOnlinePaymentMethod } from "../payments/payment-provider";
import {
  cartJson,
  finalPrice,
  orderJson,
  productJson,
  reviewJson,
} from "../common/serializers";

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // ------------------------------------------------------------------ cart
  async listCarts(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: { customerId: userId },
      orderBy: { updatedAt: "desc" },
    });
    const productIds = new Set<string>();
    for (const cart of carts) {
      for (const item of this.items(cart.items)) productIds.add(item.productId);
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...productIds] } },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return carts
      .map((cart) => {
        const hydrated = this.hydrateCart(cart, byId);
        return hydrated;
      })
      .filter((cart) => cart.items.length > 0);
  }

  async addToCart(userId: string, input: any) {
    const workshopId = String(input.workshopId ?? "");
    const productId = String(input.productId ?? "");
    const qty = Math.max(1, Number(input.qty) || 1);
    const [workshop, product] = await Promise.all([
      this.prisma.workshop.findUnique({ where: { id: workshopId } }),
      this.prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!workshop || !product || product.workshopId !== workshopId) {
      throw new ApiError("NOT_FOUND", "Product not found.", 404);
    }
    if (!product.isActive) {
      throw new ApiError("PRODUCT_UNAVAILABLE", "This product is unavailable.", 409);
    }
    if (product.stock < 1) {
      throw new ApiError("OUT_OF_STOCK", "This product is out of stock.", 409);
    }

    const cart = await this.prisma.cart.findUnique({
      where: { customerId_workshopId: { customerId: userId, workshopId } },
    });
    const items = cart ? this.items(cart.items) : [];
    const existing = items.find((item) => item.productId === productId);
    const nextQty = clamp((existing?.qty ?? 0) + qty, 1, product.stock);
    if (existing) {
      existing.qty = nextQty;
    } else {
      items.push({ id: uid("cart-item"), productId, qty: nextQty });
    }

    const saved = await this.prisma.cart.upsert({
      where: { customerId_workshopId: { customerId: userId, workshopId } },
      create: {
        id: uid("cart"),
        customerId: userId,
        workshopId,
        workshopName: workshop.name,
        workshopSlug: workshop.slug,
        items: items as unknown as Prisma.InputJsonValue,
        subtotal: 0,
      },
      update: {
        workshopName: workshop.name,
        workshopSlug: workshop.slug,
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    const products = await this.prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    return this.hydrateCart(saved, new Map(products.map((p) => [p.id, p])));
  }

  async updateCartItem(userId: string, itemId: string, qtyInput: number) {
    const carts = await this.prisma.cart.findMany({ where: { customerId: userId } });
    const cart = carts.find((entry) => this.items(entry.items).some((item) => item.id === itemId));
    if (!cart) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
    const items = this.items(cart.items);
    const item = items.find((entry) => entry.id === itemId);
    if (!item) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
    const qty = Number(qtyInput);
    if (!Number.isFinite(qty) || qty <= 0) {
      items.splice(items.indexOf(item), 1);
    } else {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
      item.qty = clamp(qty, 1, product.stock);
    }

    if (items.length === 0) {
      await this.prisma.cart.delete({ where: { id: cart.id } });
      return null;
    }
    const saved = await this.prisma.cart.update({
      where: { id: cart.id },
      data: { items: items as unknown as Prisma.InputJsonValue },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((entry) => entry.productId) } },
    });
    return this.hydrateCart(saved, new Map(products.map((p) => [p.id, p])));
  }

  async removeCartItem(userId: string, itemId: string) {
    const carts = await this.prisma.cart.findMany({ where: { customerId: userId } });
    const cart = carts.find((entry) => this.items(entry.items).some((item) => item.id === itemId));
    if (!cart) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
    const items = this.items(cart.items).filter((entry) => entry.id !== itemId);
    if (items.length === 0) {
      await this.prisma.cart.delete({ where: { id: cart.id } });
      return null;
    }
    const saved = await this.prisma.cart.update({
      where: { id: cart.id },
      data: { items: items as unknown as Prisma.InputJsonValue },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((entry) => entry.productId) } },
    });
    return this.hydrateCart(saved, new Map(products.map((p) => [p.id, p])));
  }

  async clearCart(userId: string, workshopId: string) {
    await this.prisma.cart.deleteMany({ where: { customerId: userId, workshopId } });
    return null;
  }

  // ---------------------------------------------------------------- orders
  async createOrder(userId: string, user: any, input: any) {
    const workshopId = String(input.workshopId ?? "");
    const cart = await this.prisma.cart.findUnique({
      where: { customerId_workshopId: { customerId: userId, workshopId } },
    });
    if (!cart) throw new ApiError("CART_EMPTY", "Your cart is empty.", 400);
    const cartItems = this.items(cart.items);
    if (cartItems.length === 0) throw new ApiError("CART_EMPTY", "Your cart is empty.", 400);

    const workshop = await this.prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);

    const products = await this.prisma.product.findMany({
      where: { id: { in: cartItems.map((item) => item.productId) } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of cartItems) {
      const product = productById.get(item.productId);
      if (!product || !product.isActive) {
        throw new ApiError("PRODUCT_UNAVAILABLE", "A product in your cart is unavailable.", 409);
      }
      if (product.stock < item.qty) {
        throw new ApiError("STOCK_CHANGED", `${product.title} only has ${product.stock} left.`, 409);
      }
    }

    const fulfillment = input.fulfillment === "expedition" ? "expedition" : "pickup";
    const shippingCost = 0;
    let shipping: any;
    if (fulfillment === "expedition") {
      const address = input.shipping?.address;
      if (
        !input.shipping?.courier ||
        !String(address?.recipient ?? "").trim() ||
        !String(address?.line ?? "").trim() ||
        !String(address?.city ?? "").trim() ||
        !String(address?.postalCode ?? "").trim()
      ) {
        throw new ApiError("INVALID_SHIPPING", "Complete the delivery address first.", 400);
      }
      const courier = courierById(input.shipping.courier);
      const weightGrams = totalWeight(
        cartItems.map((item) => ({
          weightGrams: productById.get(item.productId)!.weightGrams,
          qty: item.qty,
        })),
      );
      const cost = shippingCostFor(courier.id, weightGrams);
      shipping = {
        courier: courier.id,
        service: courier.service,
        cost,
        address: {
          recipient: String(address.recipient).trim(),
          phone: String(input.customerPhone ?? user.phone),
          line: String(address.line).trim(),
          city: String(address.city).trim(),
          postalCode: String(address.postalCode).trim(),
        },
      };
      (shipping as any).cost = cost;
    }

    const items = cartItems.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        id: uid("order-item"),
        productId: product.id,
        titleSnapshot: product.title,
        unitPrice: finalPrice(product),
        qty: item.qty,
        subtotal: item.qty * finalPrice(product),
        weightGrams: product.weightGrams,
        imageUrl: product.imageUrl,
        reviewed: false,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const cost = shipping?.cost ?? 0;
    const total = subtotal + cost;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const orderId = uid("ord");
    const paymentId = uid("pay");
    const code = randomCode("ORD");
    const pickupCode = randomCode("", 6).replace("-", "").slice(0, 6);
    const requestedMethod = String(input.paymentMethod ?? "va");
    const method = isOnlinePaymentMethod(requestedMethod) ? requestedMethod : "va";
    const charge = await this.payments.createCharge({
      paymentId,
      amount: total,
      method,
      expiresAt,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id: orderId,
          code,
          customerId: userId,
          customerName: user.fullName,
          customerPhone: String(input.customerPhone ?? user.phone),
          workshopId,
          workshopName: workshop.name,
          workshopSlug: workshop.slug,
          status: "pending_payment",
          fulfillment,
          shippingCost: cost,
          shipping: shipping ? (shipping as Prisma.InputJsonValue) : undefined,
          items: items as unknown as Prisma.InputJsonValue,
          subtotal,
          discountTotal: 0,
          total,
          pickupCode,
          expiresAt,
          payment: {
            create: {
              id: paymentId,
              provider: charge.provider,
              method,
              amount: total,
              status: "pending",
              providerRef: charge.providerRef,
              vaNumber: charge.vaNumber ?? null,
              qrString: charge.qrString ?? null,
              expiresAt: charge.expiresAt,
            },
          },
        },
        include: { payment: true },
      });

      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        });
      }
      await tx.cart.delete({ where: { id: cart.id } });
      await tx.notification.create({
        data: {
          id: uid("notif"),
          userId: workshop.ownerUserId,
          type: "order_created",
          title: "New shop order",
          body: `${user.fullName} placed a ${fulfillment === "expedition" ? "delivery" : "pickup"} order at ${workshop.name}.`,
          href: "/workshop/orders",
        },
      });
      return order;
    });

    return orderJson(result);
  }

  async listOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId: userId },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(orderJson);
  }

  async getOrder(userId: string, user: any, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    await this.assertOrderAccess(user, order);
    return orderJson(order);
  }

  async cancelOrder(userId: string, id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, customerId: userId },
        include: { payment: true },
      });
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.status !== "pending_payment") {
        throw new ApiError("INVALID_TRANSITION", "This order can no longer be cancelled.", 409);
      }
      const items = this.items(order.items);
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: "failed" },
      });
      return tx.order.update({
        where: { id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: "Cancelled by customer",
        },
        include: { payment: true },
      });
    });
    return orderJson(result);
  }

  async simulateOrderPayment(userId: string, user: any, id: string) {
    this.payments.assertSimulationAllowed();

    let order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    await this.assertOrderAccess(user, order);
    if (order.status === "paid") return orderJson(order);
    if (order.status !== "pending_payment") {
      throw new ApiError("INVALID_TRANSITION", "This order can no longer be paid.", 409);
    }
    if (!order.payment) {
      throw new ApiError("INVALID_TRANSITION", "This order has no payment to simulate.", 409);
    }
    if (order.payment.status === "paid") return orderJson(order);
    if (order.payment.status !== "pending") {
      throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
    }

    const now = new Date();
    if (order.payment.expiresAt <= now) {
      await this.payments.expirePendingPayments(now);
      throw new ApiError(
        "PAYMENT_EXPIRED",
        "The payment window has closed. Create a new order to try again.",
        409,
      );
    }

    const result = await this.payments.settlePaidPayment(order.payment.id);
    const current = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!current) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (result.status === "ignored" && current.status !== "paid") {
      throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
    }
    return orderJson(current);
  }

  async confirmDelivery(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.status !== "shipped") {
      throw new ApiError("INVALID_TRANSITION", "This order has not been shipped yet.", 409);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
      include: { payment: true },
    });
    const workshop = await this.prisma.workshop.findUnique({ where: { id: order.workshopId } });
    await this.prisma.notification.create({
      data: {
        id: uid("notif"),
        userId: workshop?.ownerUserId ?? userId,
        type: "order_completed",
        title: "Delivery confirmed",
        body: `The customer confirmed delivery for ${order.code}.`,
        href: "/workshop/orders",
      },
    });
    return orderJson(updated);
  }

  async reviewProduct(userId: string, input: any) {
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, customerId: userId },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.status !== "completed") {
      throw new ApiError("INVALID_TRANSITION", "Reviews open after pickup is complete.", 409);
    }
    const items = this.items(order.items);
    const item = items.find((entry) => entry.productId === input.productId);
    if (!item) throw new ApiError("NOT_FOUND", "Order item not found.", 404);
    if (item.reviewed) throw new ApiError("ALREADY_REVIEWED", "This item is already reviewed.", 409);
    const rating = this.rating(input.rating);
    const comment = this.comment(input.comment);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          id: uid("prev"),
          customerId: userId,
          customerName: order.customerName,
          workshopId: order.workshopId,
          orderId: order.id,
          productId: input.productId,
          rating,
          comment,
          tags: Array.isArray(input.tags) ? input.tags : [],
          status: "published",
        },
      });
      item.reviewed = true;
      await tx.order.update({
        where: { id: order.id },
        data: { items: items as unknown as Prisma.InputJsonValue },
      });
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (product) {
        const total = product.ratingAvg * product.ratingCount + rating;
        await tx.product.update({
          where: { id: product.id },
          data: {
            ratingCount: product.ratingCount + 1,
            ratingAvg: Math.round((total / (product.ratingCount + 1)) * 10) / 10,
          },
        });
      }
      return reviewJson(review);
    });
  }

  async reviewWorkshop(userId: string, input: any) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.serviceOrderId, customerId: userId },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "paid") {
      throw new ApiError("INVALID_TRANSITION", "Reviews open after the service is paid.", 409);
    }
    if (order.reviewId) throw new ApiError("ALREADY_REVIEWED", "This service is already reviewed.", 409);
    const workshop = await this.prisma.workshop.findUnique({ where: { id: order.workshopId } });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    const rating = this.rating(input.rating);
    const comment = this.comment(input.comment);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          id: uid("rev"),
          customerId: userId,
          customerName: order.customerName,
          workshopId: workshop.id,
          serviceOrderId: order.id,
          rating,
          comment,
          tags: Array.isArray(input.tags) ? input.tags : [],
          status: "published",
        },
      });
      const total = workshop.ratingAvg * workshop.ratingCount + rating;
      await tx.workshop.update({
        where: { id: workshop.id },
        data: {
          ratingCount: workshop.ratingCount + 1,
          ratingAvg: Math.round((total / (workshop.ratingCount + 1)) * 10) / 10,
        },
      });
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { reviewId: review.id },
      });
      return reviewJson(review);
    });
  }

  // --------------------------------------------------------------- helpers
  private items(value: unknown): any[] {
    return Array.isArray(value) ? (value as any[]) : [];
  }

  private hydrateCart(cart: any, products: Map<string, any>) {
    const items = this.items(cart.items).map((item) => {
      const product = products.get(item.productId) ?? item.product;
      const unitPrice = product ? finalPrice(product) : 0;
      return {
        id: item.id,
        productId: item.productId,
        product: product ? productJson(product) : item.product,
        qty: item.qty,
        subtotal: item.qty * unitPrice,
      };
    });
    return cartJson(cart, items);
  }

  private rating(value: unknown) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError("VALIDATION_ERROR", "Rating must be between 1 and 5.", 422);
    }
    return rating;
  }

  /** Review comments are optional, but a written one must be 10–500 chars. */
  private comment(value: unknown) {
    const comment = String(value ?? "").trim();
    if (comment.length === 0) return "";
    if (comment.length < 10 || comment.length > 500) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Review comment must be between 10 and 500 characters.",
        422,
      );
    }
    return comment;
  }

  private async assertOrderAccess(user: any, order: any) {
    if (order.customerId === user.id) return;
    if (user.role === "workshop_owner") {
      const workshop = await this.prisma.workshop.findUnique({ where: { ownerUserId: user.id } });
      if (workshop && order.workshopId === workshop.id) return;
    }
    throw new ApiError("NOT_FOUND", "Order not found.", 404);
  }
}
