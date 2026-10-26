import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { uid } from "../common/ids";
import {
  PAYMENT_PROVIDER,
  PaymentCharge,
  PaymentChargeInput,
  PaymentNotification,
  PaymentProvider,
} from "./payment-provider";

const EXPIRY_BATCH_SIZE = 200;

type PaymentKind = "order" | "serviceOrder";

interface ClosePaymentResult {
  kind: PaymentKind | null;
  changed: boolean;
}

interface SettlePaymentResult {
  status: "paid" | "already_paid" | "ignored";
  kind: PaymentKind | null;
  orderId?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  createCharge(input: PaymentChargeInput): Promise<PaymentCharge> {
    return this.provider.createCharge(input);
  }

  /** Simulation endpoints exist only for the fake provider. */
  assertSimulationAllowed() {
    if (this.provider.name !== "fake") {
      throw new ApiError("NOT_FOUND", "Payment simulation is not available.", 404);
    }
  }

  parseNotification(payload: unknown): PaymentNotification {
    if (!this.provider.parseNotification) {
      throw new ApiError("NOT_FOUND", "Payment notifications are not available.", 404);
    }
    return this.provider.parseNotification(payload);
  }

  /**
   * Provider-neutral webhook entry point. Verification and status mapping stay
   * in the adapter; locking and state transitions stay here.
   */
  async handleNotification(payload: unknown) {
    const notification = this.parseNotification(payload);
    if (notification.status === "pending" || notification.status === "ignored") {
      return { status: "ignored" as const, rawStatus: notification.rawStatus };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: notification.providerRef },
      select: { id: true },
    });
    if (!payment) {
      throw new ApiError("NOT_FOUND", "Payment not found for this provider reference.", 404);
    }

    if (notification.status === "paid") {
      const result = await this.settlePaidPayment(
        payment.id,
        notification.amount,
        notification.paidAt,
      );
      return { ...result, rawStatus: notification.rawStatus };
    }

    const result = await this.closePayment(
      payment.id,
      notification.status,
      new Date(),
      notification.status === "expired" ? "Payment expired" : "Payment failed",
      notification.amount,
    );
    return { ...result, rawStatus: notification.rawStatus };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireScheduled() {
    if (process.env.PAYMENT_EXPIRY_ENABLED === "false") return;
    try {
      const summary = await this.expirePendingPayments();
      if (summary.orders > 0 || summary.serviceOrders > 0) {
        this.logger.log(
          `Expired payments: ${summary.orders} order(s), ${summary.serviceOrders} service invoice(s).`,
        );
      }
    } catch (error) {
      this.logger.error(`Payment expiry job failed: ${(error as Error).message}`);
    }
  }

  /**
   * Expire pending payments whose window has closed. Safe to call repeatedly:
   * each row is locked and re-checked inside its transaction, so a payment
   * captured at the same moment is never marked expired.
   */
  async expirePendingPayments(now = new Date()) {
    const due = await this.prisma.payment.findMany({
      where: { status: "pending", expiresAt: { lt: now } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: EXPIRY_BATCH_SIZE,
    });

    const summary = { orders: 0, serviceOrders: 0 };
    for (const entry of due) {
      const result = await this.closePayment(entry.id, "expired", now, "Payment expired");
      if (!result.changed) continue;
      if (result.kind === "order") summary.orders += 1;
      if (result.kind === "serviceOrder") summary.serviceOrders += 1;
    }

    return summary;
  }

  /**
   * Settle a pending payment and its parent. Used by both the fake-provider
   * simulation endpoint and the real provider webhook.
   */
  async settlePaidPayment(
    paymentId: string,
    expectedAmount?: number,
    paidAt = new Date(),
  ): Promise<SettlePaymentResult> {
    const snapshot = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, orderId: true, serviceOrderId: true },
    });
    if (!snapshot) throw new ApiError("NOT_FOUND", "Payment not found.", 404);

    if (snapshot.orderId) {
      return this.settleOrderPayment(snapshot.orderId, paymentId, expectedAmount, paidAt);
    }
    if (snapshot.serviceOrderId) {
      return this.settleServiceOrderPayment(
        snapshot.serviceOrderId,
        paymentId,
        expectedAmount,
        paidAt,
      );
    }
    throw new ApiError("INVALID_TRANSITION", "This payment has no parent order.", 409);
  }

  private async settleOrderPayment(
    orderId: string,
    paymentId: string,
    expectedAmount: number | undefined,
    paidAt: Date,
  ): Promise<SettlePaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      // Match the expiry job's lock order: payment first, then order.
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new ApiError("NOT_FOUND", "Payment not found.", 404);
      if (payment.status === "paid") {
        return { status: "already_paid" as const, kind: "order" as const, orderId };
      }
      if (payment.status !== "pending") {
        return { status: "ignored" as const, kind: "order" as const, orderId };
      }
      assertAmount(payment.amount, expectedAmount);

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "pending_payment") {
        return { status: "ignored" as const, kind: "order" as const, orderId };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "paid", paidAt },
      });
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: "paid", paidAt },
      });
      await this.notifyOrderPaid(tx, updated);
      return { status: "paid" as const, kind: "order" as const, orderId };
    });
  }

  private async settleServiceOrderPayment(
    serviceOrderId: string,
    paymentId: string,
    expectedAmount: number | undefined,
    paidAt: Date,
  ): Promise<SettlePaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      // Service-order flows lock the parent first, then the payment.
      await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${serviceOrderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new ApiError("NOT_FOUND", "Payment not found.", 404);
      if (payment.status === "paid") {
        return {
          status: "already_paid" as const,
          kind: "serviceOrder" as const,
          orderId: serviceOrderId,
        };
      }
      if (payment.status !== "pending") {
        return {
          status: "ignored" as const,
          kind: "serviceOrder" as const,
          orderId: serviceOrderId,
        };
      }
      assertAmount(payment.amount, expectedAmount);

      const order = await tx.serviceOrder.findUnique({ where: { id: serviceOrderId } });
      if (!order || order.status !== "completed") {
        return {
          status: "ignored" as const,
          kind: "serviceOrder" as const,
          orderId: serviceOrderId,
        };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "paid", paidAt },
      });
      const paid = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: "paid",
          paymentMethod: payment.method,
          paidAt,
        },
      });
      await this.touchVehicle(tx, paid);
      await this.notifyServicePaid(tx, paid);
      return {
        status: "paid" as const,
        kind: "serviceOrder" as const,
        orderId: serviceOrderId,
      };
    });
  }

  /**
   * Close a pending payment as expired or failed. For shop orders this also
   * restores reserved stock; service invoices stay `completed` so the customer
   * can choose another method and retry.
   */
  private async closePayment(
    paymentId: string,
    status: "expired" | "failed",
    now: Date,
    reason: string,
    expectedAmount?: number,
  ): Promise<ClosePaymentResult> {
    const snapshot = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, orderId: true, serviceOrderId: true },
    });
    if (!snapshot) return { kind: null, changed: false };

    if (snapshot.orderId) {
      return this.closeOrderPayment(
        snapshot.orderId,
        paymentId,
        status,
        now,
        reason,
        expectedAmount,
      );
    }
    if (snapshot.serviceOrderId) {
      return this.closeServiceOrderPayment(
        snapshot.serviceOrderId,
        paymentId,
        status,
        now,
        reason,
        expectedAmount,
      );
    }

    const changed = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== "pending") return false;
      assertAmount(payment.amount, expectedAmount);
      await tx.payment.update({ where: { id: paymentId }, data: { status } });
      return true;
    });
    return { kind: null, changed };
  }

  private async closeOrderPayment(
    orderId: string,
    paymentId: string,
    status: "expired" | "failed",
    now: Date,
    reason: string,
    expectedAmount?: number,
  ): Promise<ClosePaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== "pending") {
        return { kind: "order" as const, changed: false };
      }
      assertAmount(payment.amount, expectedAmount);

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "pending_payment") {
        await tx.payment.update({ where: { id: paymentId }, data: { status } });
        return { kind: "order" as const, changed: true };
      }

      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
      for (const item of items) {
        const qty = Number(item.qty) || 0;
        if (!item.productId || qty <= 0) continue;
        await tx.product.updateMany({
          where: { id: String(item.productId) },
          data: { stock: { increment: qty } },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: status === "expired" ? "expired" : "cancelled",
          cancelReason: reason,
          cancelledAt: status === "failed" ? now : undefined,
        },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { status } });
      await tx.notification.create({
        data: {
          id: uid("notif"),
          userId: order.customerId,
          type: "order_expired",
          title: status === "expired" ? "Payment expired" : "Payment failed",
          body:
            status === "expired"
              ? `${order.code} expired and the reserved stock was released.`
              : `Payment for ${order.code} failed and the reserved stock was released.`,
          href: `/orders/${order.id}`,
        },
      });
      return { kind: "order" as const, changed: true };
    });
  }

  private async closeServiceOrderPayment(
    serviceOrderId: string,
    paymentId: string,
    status: "expired" | "failed",
    now: Date,
    reason: string,
    expectedAmount?: number,
  ): Promise<ClosePaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${serviceOrderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== "pending") {
        return { kind: "serviceOrder" as const, changed: false };
      }
      assertAmount(payment.amount, expectedAmount);

      const order = await tx.serviceOrder.findUnique({ where: { id: serviceOrderId } });
      if (!order || order.status === "paid") {
        return { kind: "serviceOrder" as const, changed: false };
      }

      await tx.payment.update({ where: { id: payment.id }, data: { status } });
      await tx.notification.create({
        data: {
          id: uid("notif"),
          userId: order.customerId,
          type: "service_payment_expired",
          title: status === "expired" ? "Invoice payment expired" : "Invoice payment failed",
          body:
            status === "expired"
              ? `The payment window for ${order.code} closed. You can choose a method and try again.`
              : `Payment for ${order.code} failed. You can choose a method and try again.`,
          href: `/bookings/${order.id}`,
        },
      });
      return { kind: "serviceOrder" as const, changed: true };
    });
  }

  private async notifyOrderPaid(tx: any, order: any) {
    const workshop = await tx.workshop.findUnique({ where: { id: order.workshopId } });
    if (!workshop) return;
    await tx.notification.create({
      data: {
        id: uid("notif"),
        userId: workshop.ownerUserId,
        type: "order_paid",
        title: "Order paid",
        body: `${order.customerName} paid ${order.code}. Prepare it for pickup.`,
        href: `/workshop/orders/${order.id}`,
      },
    });
  }

  private async notifyServicePaid(tx: any, order: any) {
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

function assertAmount(actual: number, expected?: number) {
  if (expected !== undefined && actual !== expected) {
    throw new ApiError("PAYMENT_AMOUNT_MISMATCH", "Payment amount does not match.", 400);
  }
}
