import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { randomCode, uid } from "../common/ids";
import { serviceOrderJson } from "../common/serializers";
import { resolveSlot } from "../common/slots";
import { PaymentsService } from "../payments/payments.service";
import { isOnlinePaymentMethod } from "../payments/payment-provider";

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async list(userId: string) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: { customerId: userId },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(serviceOrderJson);
  }

  async get(userId: string, user: any, id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    await this.assertAccess(user, order);
    return serviceOrderJson(order);
  }

  async create(userId: string, user: any, input: any) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id: String(input.workshopId ?? "") },
      include: { services: true },
    });
    if (!workshop || workshop.status !== "active") {
      throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    }
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: String(input.vehicleId ?? ""), customerId: userId },
    });
    if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
    if (vehicle.type !== workshop.workshopType) {
      throw new ApiError(
        "VEHICLE_TYPE_MISMATCH",
        "This workshop does not service that vehicle type.",
        422,
      );
    }
    if (Number(input.odometer) < vehicle.odometerKm) {
      throw new ApiError("ODOMETER_TOO_LOW", "Odometer cannot be lower than the last record.", 422);
    }
    if (String(input.complaint ?? "").trim().length < 10) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Please describe the complaint in at least 10 characters.",
        422,
      );
    }
    const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
    const services = workshop.services.filter((service) => serviceIds.includes(service.id));
    if (services.length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Choose at least one service.", 422);
    }
    const scheduled = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduled.getTime())) {
      throw new ApiError("VALIDATION_ERROR", "scheduledAt must be a valid ISO timestamp.", 422);
    }
    if (scheduled.getTime() < Date.now() + 60 * 60 * 1000) {
      throw new ApiError("SLOT_FULL", "Choose a slot at least one hour from now.", 409);
    }
    const resolved = resolveSlot(workshop, scheduled);
    if ("error" in resolved) {
      if (resolved.error === "CLOSED") {
        throw new ApiError("WORKSHOP_CLOSED", "The workshop is closed at that time.", 422);
      }
      throw new ApiError("VALIDATION_ERROR", "Choose one of the available hourly slots.", 422);
    }
    const slot = resolved.slot;

    const items = services.map((service) => ({
      id: uid("soi"),
      kind: service.kind,
      name: service.name,
      qty: 1,
      unitPrice: service.price,
      subtotal: service.price,
    }));
    const orderId = uid("so");
    const order = await this.prisma.$transaction(async (tx) => {
      // Serialise capacity checks per workshop; without the lock two concurrent
      // confirmations (or a confirmation racing a new booking) can both see the
      // last free slot.
      await tx.$queryRaw`SELECT "id" FROM "Workshop" WHERE "id" = ${workshop.id} FOR UPDATE`;
      const active = await tx.serviceOrder.count({
        where: {
          workshopId: workshop.id,
          status: { in: ["confirmed", "in_progress"] },
          scheduledAt: { gte: slot.start, lt: slot.end },
        },
      });
      if (active >= workshop.slotCapacityPerHour) {
        throw new ApiError("SLOT_FULL", "That slot is already full.", 409);
      }

      const created = await tx.serviceOrder.create({
        data: {
          id: orderId,
          code: randomCode("SO"),
          customerId: userId,
          customerName: user.fullName,
          customerPhone: user.phone,
          workshopId: workshop.id,
          workshopName: workshop.name,
          workshopSlug: workshop.slug,
          workshopType: workshop.workshopType,
          vehicleId: vehicle.id,
          vehicleLabel: `${vehicle.brand} ${vehicle.model}`,
          plateNumber: vehicle.plateNumber,
          status: "requested",
          scheduledAt: scheduled,
          complaint: String(input.complaint),
          customerNote: input.customerNote ? String(input.customerNote) : null,
          odometerIn: Number(input.odometer),
          estimatedTotal: items.reduce((sum, item) => sum + item.subtotal, 0),
          mechanicIds: [],
          mechanicNames: [],
          items: items as any,
          photos: [],
        },
      });
      await tx.notification.createMany({
        data: [
          {
            id: uid("notif"),
            userId: workshop.ownerUserId,
            type: "booking_requested",
            title: "New booking request",
            body: `${user.fullName} requested a slot for ${vehicle.brand} ${vehicle.model}.`,
            href: "/workshop/bookings",
          },
          {
            id: uid("notif"),
            userId: userId,
            type: "booking_requested",
            title: "Booking requested",
            body: `${workshop.name} received your request. You will be notified when it is confirmed.`,
            href: `/bookings/${created.id}`,
          },
        ],
      });
      return created;
    });
    return serviceOrderJson(order);
  }

  async cancel(userId: string, user: any, id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    await this.assertAccess(user, order);
    if (!["requested", "confirmed"].includes(order.status)) {
      throw new ApiError("INVALID_TRANSITION", "This booking can no longer be cancelled.", 409);
    }
    const hours = (order.scheduledAt.getTime() - Date.now()) / 3_600_000;
    if (user.role === "customer" && hours < 2) {
      throw new ApiError(
        "CANCELLATION_WINDOW_CLOSED",
        "Contact the workshop to cancel this slot.",
        409,
      );
    }
    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelReason: user.role === "customer" ? "Cancelled by customer" : "Cancelled by workshop",
      },
      include: { payment: true },
    });
    if (user.role === "customer") {
      const workshop = await this.prisma.workshop.findUnique({ where: { id: order.workshopId } });
      if (workshop) {
        await this.prisma.notification.create({
          data: {
            id: uid("notif"),
            userId: workshop.ownerUserId,
            type: "booking_declined",
            title: "Booking cancelled",
            body: `${order.customerName} cancelled ${order.code}.`,
            href: "/workshop/bookings",
          },
        });
      }
    }
    return serviceOrderJson(updated);
  }

  async approveEstimate(userId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId: userId },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "awaiting_approval") {
      throw new ApiError("INVALID_TRANSITION", "There is no estimate to approve.", 409);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: "completed", completedAt: new Date() },
        include: { payment: true },
      });
      await this.touchVehicle(tx, updated);
      return serviceOrderJson(updated);
    });
  }

  async rejectEstimate(userId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId: userId },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status !== "awaiting_approval") {
      throw new ApiError("INVALID_TRANSITION", "There is no estimate to reject.", 409);
    }
    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: "in_progress",
        mechanicNote: "Customer rejected the revised estimate. The workshop is reviewing the items.",
      },
      include: { payment: true },
    });
    return serviceOrderJson(updated);
  }

  async pay(userId: string, id: string, methodInput: string) {
    const method = String(methodInput ?? "qris");
    if (!["va", "bank_transfer", "qris", "cash"].includes(method)) {
      throw new ApiError("VALIDATION_ERROR", "Unsupported payment method.", 422);
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId: userId },
      include: { payment: true },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status === "paid") return serviceOrderJson(order);
    if (order.status !== "completed") {
      throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
    }

    if (method === "cash") return this.payCash(userId, id);
    if (!isOnlinePaymentMethod(method)) {
      throw new ApiError("VALIDATION_ERROR", "Unsupported payment method.", 422);
    }

    const now = new Date();
    if (order.payment?.status === "pending" && order.payment.expiresAt > now) {
      return serviceOrderJson(order);
    }

    const amount = order.finalTotal ?? order.estimatedTotal;
    if (amount <= 0) {
      throw new ApiError("VALIDATION_ERROR", "The invoice has no amount to pay.", 422);
    }

    const paymentId = order.payment?.id ?? uid("pay");
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const charge = await this.payments.createCharge({
      paymentId,
      amount,
      method,
      expiresAt,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.serviceOrder.findUnique({
        where: { id },
        include: { payment: true },
      });
      if (!current) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (current.status === "paid") return current;
      if (current.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
      }
      if (current.payment?.status === "pending" && current.payment.expiresAt > new Date()) {
        return current;
      }

      const data = {
        provider: charge.provider,
        method,
        amount,
        status: "pending",
        providerRef: charge.providerRef,
        vaNumber: charge.vaNumber ?? null,
        qrString: charge.qrString ?? null,
        expiresAt: charge.expiresAt,
        paidAt: null,
      };
      if (current.payment) {
        await tx.payment.update({ where: { id: current.payment.id }, data });
      } else {
        await tx.payment.create({
          data: { id: paymentId, serviceOrderId: id, ...data },
        });
      }
      return tx.serviceOrder.findUnique({ where: { id }, include: { payment: true } });
    });

    return serviceOrderJson(updated);
  }

  async simulatePaid(userId: string, id: string) {
    this.payments.assertSimulationAllowed();

    let order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId: userId },
      include: { payment: true },
    });
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (order.status === "paid") return serviceOrderJson(order);
    if (order.status !== "completed") {
      throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
    }
    if (!order.payment) {
      throw new ApiError("INVALID_TRANSITION", "Create a payment first.", 409);
    }
    if (order.payment.status === "paid") return serviceOrderJson(order);
    if (order.payment.status === "expired") {
      throw new ApiError(
        "PAYMENT_EXPIRED",
        "The payment window has closed. Choose a method to try again.",
        409,
      );
    }
    if (order.payment.status !== "pending") {
      throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
    }

    const now = new Date();
    if (order.payment.expiresAt <= now) {
      await this.payments.expirePendingPayments(now);
      throw new ApiError(
        "PAYMENT_EXPIRED",
        "The payment window has closed. Choose a method to try again.",
        409,
      );
    }

    const result = await this.payments.settlePaidPayment(order.payment.id);
    const current = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!current) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    if (result.status === "ignored" && current.status !== "paid") {
      if (current.payment?.status === "expired") {
        throw new ApiError("PAYMENT_EXPIRED", "The payment window has closed.", 409);
      }
      throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
    }
    return serviceOrderJson(current);
  }

  private async payCash(userId: string, id: string) {
    const paidAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.serviceOrder.findUnique({
        where: { id },
        include: { payment: true },
      });
      if (!current || current.customerId !== userId) {
        throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      }
      if (current.status === "paid") return current;
      if (current.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
      }

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

      const paid = await tx.serviceOrder.update({
        where: { id },
        data: { status: "paid", paymentMethod: "cash", paidAt },
        include: { payment: true },
      });
      await this.touchVehicle(tx, paid);
      await this.notifyPaid(tx, paid);
      return paid;
    });

    return serviceOrderJson(updated);
  }

  private async notifyPaid(tx: any, order: any) {
    const workshop = await tx.workshop.findUnique({ where: { id: order.workshopId } });
    if (!workshop) return;
    await tx.notification.create({
      data: {
        id: uid("notif"),
        userId: workshop.ownerUserId,
        type: "service_paid",
        title: "Service paid",
        body: `${order.customerName} paid ${order.code}.`,
        href: `/workshop/service-orders/${order.id}`,
      },
    });
  }

  async assertAccess(user: any, order: any) {
    if (order.customerId === user.id) return;
    if (user.role === "workshop_owner") {
      const workshop = await this.prisma.workshop.findUnique({ where: { ownerUserId: user.id } });
      if (workshop && order.workshopId === workshop.id) return;
    }
    throw new ApiError("NOT_FOUND", "Booking not found.", 404);
  }

  async touchVehicle(tx: any, order: any) {
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
