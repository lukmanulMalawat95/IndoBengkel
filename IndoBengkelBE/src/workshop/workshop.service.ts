import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { clamp, randomCode, slugify, uid } from "../common/ids";
import { dateKeyInJakarta } from "../common/geo";
import { slotWindowFor } from "../common/slots";
import { courierName } from "../common/shipping";
import {
  orderJson,
  reviewJson,
  serviceOrderJson,
  workshopJson,
} from "../common/serializers";

@Injectable()
export class WorkshopService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------- profile
  async me(user: any) {
    const workshop = await this.requireOwner(user);
    return workshopJson(workshop, { publicView: false });
  }

  async updateMe(user: any, input: any) {
    const workshop = await this.requireOwner(user);
    const data: any = {};
    const allowed = [
      "name",
      "description",
      "workshopType",
      "phone",
      "email",
      "addressLine",
      "city",
      "province",
      "postalCode",
      "countryCode",
      "lat",
      "lng",
      "timezone",
      "coverUrl",
      "logoUrl",
      "gallery",
      "hours",
      "closures",
      "slotCapacityPerHour",
    ];
    for (const key of allowed) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (Array.isArray(input.gallery)) data.gallery = input.gallery.slice(0, 6);
    if (data.hours !== undefined && !Array.isArray(data.hours)) delete data.hours;
    if (data.closures !== undefined && !Array.isArray(data.closures)) delete data.closures;

    const complete = Boolean(
      (data.name ?? workshop.name) &&
        (data.workshopType ?? workshop.workshopType) &&
        (data.phone ?? workshop.phone) &&
        (data.addressLine ?? workshop.addressLine) &&
        (data.coverUrl ?? workshop.coverUrl) &&
        this.hasOpenHour(data.hours ?? workshop.hours) &&
        user.emailVerified,
    );
    data.status = complete ? "active" : "draft";

    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data,
      include: this.ownerInclude(),
    });
    return workshopJson(updated, { publicView: false });
  }

  // -------------------------------------------------------------- mechanics
  async listMechanics(user: any) {
    const workshop = await this.requireOwner(user);
    const mechanics = await this.prisma.mechanic.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: "asc" },
    });
    return mechanics.map((mechanic) => this.mechanicJson(mechanic));
  }

  async createMechanic(user: any, input: any) {
    const workshop = await this.requireOwner(user);
    const mechanic = await this.prisma.mechanic.create({
      data: {
        id: uid("mech"),
        workshopId: workshop.id,
        name: String(input.name ?? "").trim() || "New mechanic",
        phone: String(input.phone ?? "").trim(),
        experienceYears: Number(input.experienceYears) || 0,
        skills: Array.isArray(input.skills) ? input.skills : [],
        photoUrl: input.photoUrl ? String(input.photoUrl) : null,
        isActive: input.isActive !== false,
      },
    });
    return this.mechanicJson(mechanic);
  }

  async updateMechanic(user: any, id: string, input: any) {
    const workshop = await this.requireOwner(user);
    const mechanic = await this.prisma.mechanic.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!mechanic) throw new ApiError("NOT_FOUND", "Mechanic not found.", 404);
    const updated = await this.prisma.mechanic.update({
      where: { id },
      data: {
        name: input.name ?? mechanic.name,
        phone: input.phone ?? mechanic.phone,
        experienceYears: input.experienceYears ?? mechanic.experienceYears,
        skills: input.skills ?? mechanic.skills,
        photoUrl: input.photoUrl === undefined ? mechanic.photoUrl : input.photoUrl || null,
        isActive: input.isActive ?? mechanic.isActive,
      },
    });
    return this.mechanicJson(updated);
  }

  async deleteMechanic(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    await this.prisma.mechanic.deleteMany({ where: { id, workshopId: workshop.id } });
    return { ok: true };
  }

  // --------------------------------------------------------------- services
  async listServices(user: any) {
    const workshop = await this.requireOwner(user);
    const services = await this.prisma.service.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: "asc" },
    });
    return services.map((service) => this.serviceJson(service));
  }

  async createService(user: any, input: any) {
    const workshop = await this.requireOwner(user);
    const service = await this.prisma.service.create({
      data: {
        id: uid("svc"),
        workshopId: workshop.id,
        name: String(input.name ?? "").trim() || "New service",
        description: String(input.description ?? ""),
        price: Math.max(0, Number(input.price) || 0),
        durationMinutes: Math.max(5, Number(input.durationMinutes) || 30),
        category: input.category ?? "other",
        kind: input.kind === "part" ? "part" : "labor",
        isActive: input.isActive !== false,
      },
    });
    return this.serviceJson(service);
  }

  async updateService(user: any, id: string, input: any) {
    const workshop = await this.requireOwner(user);
    const service = await this.prisma.service.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!service) throw new ApiError("NOT_FOUND", "Service not found.", 404);
    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        name: input.name ?? service.name,
        description: input.description ?? service.description,
        price: input.price ?? service.price,
        durationMinutes: input.durationMinutes ?? service.durationMinutes,
        category: input.category ?? service.category,
        kind: input.kind ?? service.kind,
        isActive: input.isActive ?? service.isActive,
      },
    });
    return this.serviceJson(updated);
  }

  async deleteService(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    await this.prisma.service.deleteMany({ where: { id, workshopId: workshop.id } });
    return { ok: true };
  }

  // --------------------------------------------------------------- products
  async listProducts(user: any) {
    const workshop = await this.requireOwner(user);
    const products = await this.prisma.product.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: "asc" },
    });
    return products.map((product) => this.productJson(product));
  }

  async createProduct(user: any, input: any) {
    const workshop = await this.requireOwner(user);
    const price = Math.max(1, Number(input.price) || 1);
    const title = String(input.title ?? "").trim() || "New product";
    const baseSlug = slugify(title) || `product-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const product = await this.prisma.product.create({
      data: {
        id: uid("prod"),
        workshopId: workshop.id,
        workshopSlug: workshop.slug,
        workshopName: workshop.name,
        workshopType: workshop.workshopType,
        title,
        slug,
        description: String(input.description ?? ""),
        category: input.category ?? "other",
        brand: String(input.brand ?? ""),
        partNumber: String(input.partNumber ?? ""),
        price,
        discountType: input.discountType ?? "none",
        discountValue: Number(input.discountValue) || 0,
        weightGrams: Math.max(1, Number(input.weightGrams) || 1),
        stock: Math.max(0, Number(input.stock) || 0),
        isActive: input.isActive !== false,
        ratingAvg: 0,
        ratingCount: 0,
        imageUrl: String(input.imageUrl ?? ""),
      },
    });
    return this.productJson(product);
  }

  async updateProduct(user: any, id: string, input: any) {
    const workshop = await this.requireOwner(user);
    const product = await this.prisma.product.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        title: input.title ?? product.title,
        description: input.description ?? product.description,
        category: input.category ?? product.category,
        brand: input.brand ?? product.brand,
        partNumber: input.partNumber ?? product.partNumber,
        price: input.price ?? product.price,
        discountType: input.discountType ?? product.discountType,
        discountValue: input.discountValue ?? product.discountValue,
        weightGrams: input.weightGrams ?? product.weightGrams,
        stock: input.stock ?? product.stock,
        isActive: input.isActive ?? product.isActive,
        imageUrl: input.imageUrl === undefined ? product.imageUrl : input.imageUrl || "",
      },
    });
    return this.productJson(updated);
  }

  async deleteProduct(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    await this.prisma.product.updateMany({
      where: { id, workshopId: workshop.id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  // --------------------------------------------------------------- bookings
  async listBookings(user: any, status?: string) {
    const workshop = await this.requireOwner(user);
    const orders = await this.prisma.serviceOrder.findMany({
      where: { workshopId: workshop.id, ...(status ? { status } : {}) },
      include: { payment: true },
      orderBy: { scheduledAt: "asc" },
    });
    return orders.map(serviceOrderJson);
  }

  async confirmBooking(user: any, id: string, estimatedTotal: number) {
    const workshop = await this.requireOwner(user);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Lock the workshop so two confirmations cannot both claim the last slot.
      await tx.$queryRaw`SELECT "id" FROM "Workshop" WHERE "id" = ${workshop.id} FOR UPDATE`;
      const order = await tx.serviceOrder.findFirst({
        where: { id, workshopId: workshop.id },
      });
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "requested") {
        throw new ApiError("INVALID_TRANSITION", "Only requested bookings can be confirmed.", 409);
      }

      const slot = slotWindowFor(workshop, order.scheduledAt);
      const active = await tx.serviceOrder.count({
        where: {
          workshopId: workshop.id,
          status: { in: ["confirmed", "in_progress"] },
          scheduledAt: { gte: slot.start, lt: slot.end },
          id: { not: order.id },
        },
      });
      if (active >= workshop.slotCapacityPerHour) {
        throw new ApiError("SLOT_FULL", "That slot is already full.", 409);
      }

      return tx.serviceOrder.update({
        where: { id },
        data: { status: "confirmed", estimatedTotal: Number(estimatedTotal) || 0 },
        include: { payment: true },
      });
    });
    await this.notify(
      updated.customerId,
      "booking_confirmed",
      "Booking confirmed",
      `${updated.workshopName} confirmed ${updated.code} with an estimate of Rp ${Number(estimatedTotal).toLocaleString("id-ID")}.`,
      `/bookings/${updated.id}`,
    );
    return serviceOrderJson(updated);
  }

  async declineBooking(user: any, id: string, reason: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "requested") {
      throw new ApiError("INVALID_TRANSITION", "Only requested bookings can be declined.", 409);
    }
    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: { status: "declined", cancelReason: String(reason ?? "") },
      include: { payment: true },
    });
    await this.notify(
      order.customerId,
      "booking_declined",
      "Booking declined",
      `${order.workshopName} declined ${order.code}: ${reason}`,
      `/bookings/${order.id}`,
    );
    return serviceOrderJson(updated);
  }

  async startService(user: any, id: string, odometerIn: number, mechanicIds: string[]) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "confirmed") {
      throw new ApiError("INVALID_TRANSITION", "Only confirmed bookings can start.", 409);
    }
    const mechanics = await this.prisma.mechanic.findMany({
      where: {
        workshopId: workshop.id,
        id: { in: Array.isArray(mechanicIds) ? mechanicIds : [] },
        isActive: true,
      },
    });
    if (mechanics.length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Assign at least one active mechanic.", 422);
    }
    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: "in_progress",
        odometerIn: Number(odometerIn) || order.odometerIn,
        startedAt: new Date(),
        mechanicIds: mechanics.map((mechanic) => mechanic.id),
        mechanicNames: mechanics.map((mechanic) => mechanic.name),
      },
      include: { payment: true },
    });
    await this.notify(
      order.customerId,
      "service_started",
      "Service started",
      `${order.workshopName} started work on ${order.vehicleLabel}.`,
      `/bookings/${order.id}`,
    );
    return serviceOrderJson(updated);
  }

  async completeService(
    user: any,
    id: string,
    input: { items?: any[]; photos?: string[]; mechanicNote?: string; finalTotal?: number },
  ) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "in_progress") {
      throw new ApiError("INVALID_TRANSITION", "Only in-progress services can be completed.", 409);
    }
    const items = Array.isArray(input.items) ? input.items : [];
    const finalTotal = Number(input.finalTotal) || 0;
    if (items.length === 0 || finalTotal <= 0) {
      throw new ApiError("VALIDATION_ERROR", "Add at least one invoice item.", 422);
    }
    const needsApproval = finalTotal > order.estimatedTotal * 1.5;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.serviceOrder.update({
        where: { id },
        data: {
          items: items as unknown as Prisma.InputJsonValue,
          photos: Array.isArray(input.photos) ? input.photos.slice(0, 4) : [],
          mechanicNote: String(input.mechanicNote ?? ""),
          finalTotal,
          odometerOut: order.odometerIn,
          status: needsApproval ? "awaiting_approval" : "completed",
          completedAt: new Date(),
        },
        include: { payment: true },
      });
      if (!needsApproval) {
        await this.touchVehicle(tx, next);
      }
      return next;
    });

    await this.notify(
      order.customerId,
      needsApproval ? "estimate_approval" : "service_completed",
      needsApproval ? "Estimate needs approval" : "Service completed",
      needsApproval
        ? `${order.workshopName} revised the invoice above your estimate. Review it before work continues.`
        : `${order.workshopName} completed ${order.code}. Your invoice is ready.`,
      `/bookings/${order.id}`,
    );
    return serviceOrderJson(updated);
  }

  async markCashPaid(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "completed") {
      throw new ApiError("INVALID_TRANSITION", "Cash can only be recorded for a completed service.", 409);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.serviceOrder.findUnique({
        where: { id },
        include: { payment: true },
      });
      if (!current) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (current.status === "paid") return current;
      if (current.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "Cash can only be recorded for a completed service.", 409);
      }

      const paidAt = new Date();
      const amount = current.finalTotal ?? current.estimatedTotal;
      const data = {
        provider: "cash",
        method: "cash",
        amount,
        status: "paid",
        providerRef: uid("cash"),
        vaNumber: null,
        qrString: null,
        expiresAt: paidAt,
        paidAt,
      };
      if (current.payment) {
        await tx.payment.update({ where: { id: current.payment.id }, data });
      } else {
        await tx.payment.create({
          data: { id: uid("pay"), serviceOrderId: id, ...data },
        });
      }

      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: "paid", paymentMethod: "cash", paidAt },
        include: { payment: true },
      });
      await this.touchVehicle(tx, updated);
      return serviceOrderJson(updated);
    });
  }

  async markNoShow(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "confirmed") {
      throw new ApiError("INVALID_TRANSITION", "Only confirmed bookings can be marked no-show.", 409);
    }
    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: { status: "no_show" },
      include: { payment: true },
    });
    return serviceOrderJson(updated);
  }

  // ----------------------------------------------------------------- orders
  async listOrders(user: any, status?: string) {
    const workshop = await this.requireOwner(user);
    const orders = await this.prisma.order.findMany({
      where: { workshopId: workshop.id, ...(status ? { status } : {}) },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(orderJson);
  }

  async markPreparing(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.order.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.status !== "paid") {
      throw new ApiError("INVALID_TRANSITION", "Only paid orders can be prepared.", 409);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "preparing", preparingAt: new Date() },
      include: { payment: true },
    });
    return orderJson(updated);
  }

  async markReady(user: any, id: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.order.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.status !== "preparing") {
      throw new ApiError("INVALID_TRANSITION", "Only preparing orders can be marked ready.", 409);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "ready_for_pickup", readyAt: new Date() },
      include: { payment: true },
    });
    await this.notify(
      order.customerId,
      "order_ready",
      order.fulfillment === "expedition" ? "Order ready to ship" : "Order ready for pickup",
      order.fulfillment === "expedition"
        ? `${order.workshopName} is packing ${order.code}. We will add the tracking number once it is handed to the courier.`
        : `${order.workshopName} marked ${order.code} ready. Show your pickup code at the counter.`,
      `/orders/${order.id}`,
    );
    return orderJson(updated);
  }

  async shipOrder(user: any, id: string, trackingNumber: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.order.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.fulfillment !== "expedition" || !order.shipping) {
      throw new ApiError("INVALID_FULFILLMENT", "This order is for pickup, not delivery.", 409);
    }
    if (order.status !== "ready_for_pickup") {
      throw new ApiError("INVALID_TRANSITION", "Only packed orders can be shipped.", 409);
    }
    const tracking = String(trackingNumber ?? "").trim();
    if (tracking.length < 4) {
      throw new ApiError("INVALID_TRACKING", "Enter a valid tracking number.", 400);
    }
    const shipping = { ...(order.shipping as any), trackingNumber: tracking, shippedAt: new Date().toISOString() };
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "shipped", shipping },
      include: { payment: true },
    });
    await this.notify(
      order.customerId,
      "order_shipped",
      "Order shipped",
      `${order.code} is on the way with ${courierName(shipping.courier)}. Tracking: ${tracking}.`,
      `/orders/${order.id}`,
    );
    return orderJson(updated);
  }

  async verifyPickup(user: any, id: string, pickupCode: string) {
    const workshop = await this.requireOwner(user);
    const order = await this.prisma.order.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    if (order.fulfillment === "expedition") {
      throw new ApiError("INVALID_FULFILLMENT", "This order is delivered by courier.", 409);
    }
    if (order.status !== "ready_for_pickup") {
      throw new ApiError("INVALID_TRANSITION", "This order is not ready for pickup.", 409);
    }
    if (order.pickupCode.toLowerCase() !== String(pickupCode ?? "").trim().toLowerCase()) {
      throw new ApiError("INVALID_PICKUP_CODE", "Pickup code does not match.", 400);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
      include: { payment: true },
    });
    await this.notify(
      order.customerId,
      "order_completed",
      "Pickup complete",
      `Your order at ${order.workshopName} is complete. Leave a review for the parts you bought.`,
      `/orders/${order.id}`,
    );
    return orderJson(updated);
  }

  // ---------------------------------------------------------------- reviews
  async listReviews(user: any) {
    const workshop = await this.requireOwner(user);
    const reviews = await this.prisma.review.findMany({
      where: { workshopId: workshop.id, productId: null },
      orderBy: { createdAt: "desc" },
    });
    return reviews.map(reviewJson);
  }

  async replyReview(user: any, id: string, body: string) {
    const workshop = await this.requireOwner(user);
    const review = await this.prisma.review.findFirst({
      where: { id, workshopId: workshop.id },
    });
    if (!review) throw new ApiError("NOT_FOUND", "Review not found.", 404);
    if (review.workshopReply) {
      throw new ApiError("DUPLICATE_REPLY", "This review already has a reply.", 409);
    }
    const updated = await this.prisma.review.update({
      where: { id },
      data: { workshopReply: String(body ?? ""), repliedAt: new Date() },
    });
    await this.notify(
      review.customerId,
      "review_reply",
      "Workshop replied to your review",
      `${workshop.name} replied to your review.`,
      "/notifications",
    );
    return reviewJson(updated);
  }

  // -------------------------------------------------------------- dashboard
  async dashboard(user: any) {
    const workshop = await this.requireOwner(user);
    const [fullWorkshop, serviceOrders, orders, reviews] = await Promise.all([
      this.prisma.workshop.findUnique({
        where: { id: workshop.id },
        include: this.ownerInclude(),
      }),
      this.prisma.serviceOrder.findMany({
        where: { workshopId: workshop.id },
        include: { payment: true },
      }),
      this.prisma.order.findMany({
        where: { workshopId: workshop.id },
        include: { payment: true },
      }),
      this.prisma.review.findMany({
        where: { workshopId: workshop.id, productId: null, status: "published" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of reviews) distribution[review.rating] += 1;

    const todayKey = dateKeyInJakarta(new Date());
    const todayBookings = serviceOrders.filter(
      (order) =>
        dateKeyInJakarta(order.scheduledAt) === todayKey &&
        ["requested", "confirmed", "in_progress"].includes(order.status),
    );
    const activeServiceOrders = serviceOrders.filter((order) =>
      ["confirmed", "in_progress", "awaiting_approval"].includes(order.status),
    );
    const ordersNeedingAction = orders.filter((order) =>
      ["paid", "preparing", "ready_for_pickup"].includes(order.status),
    );

    const now = new Date();
    const inMonth = (value?: Date | null) =>
      Boolean(value) && value!.getMonth() === now.getMonth() && value!.getFullYear() === now.getFullYear();
    const revenueThisMonth =
      serviceOrders
        .filter((order) => order.status === "paid" && inMonth(order.paidAt))
        .reduce((sum, order) => sum + (order.finalTotal ?? order.estimatedTotal), 0) +
      orders
        .filter(
          (order) =>
            inMonth(order.paidAt) &&
            !["cancelled", "expired", "pending_payment"].includes(order.status),
        )
        .reduce((sum, order) => sum + order.total, 0);

    const hours = Array.isArray(fullWorkshop.hours) ? (fullWorkshop.hours as any[]) : [];
    const profileChecklist = [
      { key: "name", label: "Workshop name", done: Boolean(fullWorkshop.name) },
      { key: "type", label: "Workshop type", done: Boolean(fullWorkshop.workshopType) },
      { key: "phone", label: "Phone number", done: Boolean(fullWorkshop.phone) },
      {
        key: "address",
        label: "Address and coordinates",
        done: Boolean(fullWorkshop.addressLine && fullWorkshop.lat && fullWorkshop.lng),
      },
      { key: "hours", label: "Opening hours", done: hours.some((hour) => !hour.isClosed) },
      { key: "cover", label: "Cover image", done: Boolean(fullWorkshop.coverUrl) },
      { key: "email", label: "Verified email", done: user.emailVerified },
    ];

    return {
      workshop: workshopJson(fullWorkshop, { publicView: true }),
      ratingAvg: fullWorkshop.ratingAvg,
      ratingCount: fullWorkshop.ratingCount,
      distribution,
      recentReviews: reviews.slice(0, 5).map(reviewJson),
      todayBookings: todayBookings.map(serviceOrderJson),
      activeServiceOrders: activeServiceOrders.map(serviceOrderJson),
      ordersNeedingAction: ordersNeedingAction.map(orderJson),
      revenueThisMonth,
      profileChecklist,
    };
  }

  // ---------------------------------------------------------------- helpers
  private async requireOwner(user: any) {
    if (user.role !== "workshop_owner") {
      throw new ApiError("FORBIDDEN", "You do not have access to this resource.", 403);
    }
    const workshop = await this.prisma.workshop.findUnique({
      where: { ownerUserId: user.id },
      include: this.ownerInclude(),
    });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    return workshop;
  }

  private ownerInclude() {
    return {
      services: true,
      mechanics: true,
      products: true,
      reviews: { orderBy: { createdAt: "desc" as const } },
    };
  }

  private hasOpenHour(hours: unknown) {
    return Array.isArray(hours) && hours.some((hour: any) => !hour.isClosed);
  }

  private mechanicJson(mechanic: any) {
    return {
      id: mechanic.id,
      workshopId: mechanic.workshopId,
      name: mechanic.name,
      phone: mechanic.phone,
      experienceYears: mechanic.experienceYears,
      skills: mechanic.skills ?? [],
      photoUrl: mechanic.photoUrl ?? undefined,
      isActive: mechanic.isActive,
    };
  }

  private serviceJson(service: any) {
    return {
      id: service.id,
      workshopId: service.workshopId,
      name: service.name,
      description: service.description,
      price: service.price,
      durationMinutes: service.durationMinutes,
      category: service.category,
      kind: service.kind,
      isActive: service.isActive,
    };
  }

  private productJson(product: any) {
    return {
      id: product.id,
      workshopId: product.workshopId,
      workshopSlug: product.workshopSlug,
      workshopName: product.workshopName,
      workshopType: product.workshopType,
      title: product.title,
      slug: product.slug,
      description: product.description,
      category: product.category,
      brand: product.brand,
      partNumber: product.partNumber,
      price: product.price,
      finalPrice:
        product.discountType === "percent"
          ? Math.round(product.price * (1 - product.discountValue / 100))
          : product.discountType === "fixed"
            ? Math.max(0, product.price - product.discountValue)
            : product.price,
      discountType: product.discountType,
      discountValue: product.discountValue,
      weightGrams: product.weightGrams,
      stock: product.stock,
      isActive: product.isActive,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      imageUrl: product.imageUrl,
    };
  }

  private async notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    href?: string,
  ) {
    await this.prisma.notification.create({
      data: {
        id: uid("notif"),
        userId,
        type,
        title,
        body,
        href,
      },
    });
  }

  private async touchVehicle(tx: any, order: any) {
    if (order.odometerOut === null || order.odometerOut === undefined) return;
    const vehicle = await tx.vehicle.findUnique({ where: { id: order.vehicleId } });
    if (!vehicle) return;
    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: {
        odometerKm: Math.max(vehicle.odometerKm, order.odometerOut),
        lastServiceAt: new Date(),
        lastWorkshopName: order.workshopName,
      },
    });
  }
}
