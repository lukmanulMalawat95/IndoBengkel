import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { uid } from "../common/ids";
import {
  PAYMENT_PROVIDER,
  PaymentCharge,
  PaymentChargeInput,
  PaymentProvider,
} from "./payment-provider";

const EXPIRY_BATCH_SIZE = 200;

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
      const kind = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${entry.id} FOR UPDATE`;
        const payment = await tx.payment.findUnique({ where: { id: entry.id } });
        if (!payment || payment.status !== "pending" || payment.expiresAt >= now) {
          return null;
        }

        if (payment.orderId) {
          const order = await tx.order.findUnique({ where: { id: payment.orderId } });
          if (!order || order.status !== "pending_payment") return null;

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
            data: { status: "expired", cancelReason: "Payment expired" },
          });
          await tx.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
          await tx.notification.create({
            data: {
              id: uid("notif"),
              userId: order.customerId,
              type: "order_expired",
              title: "Payment expired",
              body: `${order.code} expired and the reserved stock was released.`,
              href: `/orders/${order.id}`,
            },
          });
          return "order";
        }

        if (payment.serviceOrderId) {
          const order = await tx.serviceOrder.findUnique({
            where: { id: payment.serviceOrderId },
          });
          if (!order || order.status === "paid") return null;

          await tx.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
          await tx.notification.create({
            data: {
              id: uid("notif"),
              userId: order.customerId,
              type: "service_payment_expired",
              title: "Invoice payment expired",
              body: `The payment window for ${order.code} closed. You can choose a method and try again.`,
              href: `/bookings/${order.id}`,
            },
          });
          return "serviceOrder";
        }

        await tx.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
        return null;
      });

      if (kind === "order") summary.orders += 1;
      if (kind === "serviceOrder") summary.serviceOrders += 1;
    }

    return summary;
  }
}
