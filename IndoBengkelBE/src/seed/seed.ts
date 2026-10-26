import { PrismaClient, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import seedData from "../../prisma/seed-data.json";

const db = seedData as any;
const DEMO_PASSWORD = "password123";

function asDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? []) as Prisma.InputJsonValue;
}

/**
 * Replace every row with the curated IndoBengkel demo dataset.
 * Idempotent: safe to run on every container start.
 */
export async function seedDatabase(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Payment","Order","Cart","Session","Message","Conversation","Notification","Review","ServiceOrder","Vehicle","Product","Service","Mechanic","Workshop","User" CASCADE;`,
  );

  // ---------------------------------------------------------------- users
  const knownUsers = new Map<string, any>();
  for (const user of db.users) knownUsers.set(user.id, user);

  const owners: any[] = [];
  db.workshops.forEach((workshop: any, index: number) => {
    if (knownUsers.has(workshop.ownerUserId)) return;
    const number = index + 1;
    owners.push({
      id: workshop.ownerUserId,
      email: `owner${number}@indobengkel.test`,
      fullName: `Owner ${workshop.name}`,
      phone: workshop.phone,
      role: "workshop_owner",
      locale: "id",
      emailVerified: true,
      status: "active",
      createdAt: workshop.createdAt,
    });
  });

  const allUsers = [
    ...db.users.map((user: any) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      locale: user.locale ?? "en",
      avatarUrl: user.avatarUrl ?? null,
      emailVerified: true,
      status: user.status ?? "active",
      createdAt: asDate(user.createdAt) ?? new Date(),
    })),
    ...owners,
  ];

  await prisma.user.createMany({
    data: allUsers.map((user) => ({
      ...user,
      passwordHash,
    })),
  });

  // ------------------------------------------------------------ workshops
  await prisma.workshop.createMany({
    data: db.workshops.map((workshop: any) => ({
      id: workshop.id,
      ownerUserId: workshop.ownerUserId,
      name: workshop.name,
      slug: workshop.slug,
      description: workshop.description ?? "",
      workshopType: workshop.workshopType,
      phone: workshop.phone,
      email: workshop.email,
      addressLine: workshop.addressLine,
      city: workshop.city,
      province: workshop.province ?? "",
      postalCode: workshop.postalCode ?? "",
      countryCode: workshop.countryCode ?? "ID",
      lat: workshop.lat,
      lng: workshop.lng,
      timezone: workshop.timezone ?? "Asia/Jakarta",
      coverUrl: workshop.coverUrl ?? "",
      logoUrl: workshop.logoUrl ?? null,
      gallery: workshop.gallery ?? [],
      status: workshop.status ?? "active",
      ratingAvg: workshop.ratingAvg ?? 0,
      ratingCount: workshop.ratingCount ?? 0,
      hours: json(workshop.hours),
      closures: json(workshop.closures),
      slotCapacityPerHour: workshop.slotCapacityPerHour ?? 1,
      createdAt: asDate(workshop.createdAt) ?? new Date(),
    })),
  });

  await prisma.mechanic.createMany({
    data: db.workshops.flatMap((workshop: any) =>
      (workshop.mechanics ?? []).map((mechanic: any) => ({
        id: mechanic.id,
        workshopId: workshop.id,
        name: mechanic.name,
        phone: mechanic.phone,
        experienceYears: mechanic.experienceYears ?? 0,
        skills: mechanic.skills ?? [],
        photoUrl: mechanic.photoUrl ?? null,
        isActive: mechanic.isActive ?? true,
      })),
    ),
  });

  await prisma.service.createMany({
    data: db.workshops.flatMap((workshop: any) =>
      (workshop.services ?? []).map((service: any) => ({
        id: service.id,
        workshopId: workshop.id,
        name: service.name,
        description: service.description ?? "",
        price: service.price ?? 0,
        durationMinutes: service.durationMinutes ?? 30,
        category: service.category ?? "other",
        kind: service.kind ?? "labor",
        isActive: service.isActive ?? true,
      })),
    ),
  });

  await prisma.product.createMany({
    data: db.workshops.flatMap((workshop: any) =>
      (workshop.products ?? []).map((product: any) => ({
        id: product.id,
        workshopId: workshop.id,
        workshopSlug: product.workshopSlug ?? workshop.slug,
        workshopName: product.workshopName ?? workshop.name,
        workshopType: product.workshopType ?? workshop.workshopType,
        title: product.title,
        slug: product.slug,
        description: product.description ?? "",
        category: product.category ?? "other",
        brand: product.brand ?? "",
        partNumber: product.partNumber ?? "",
        price: product.price ?? 0,
        discountType: product.discountType ?? "none",
        discountValue: product.discountValue ?? 0,
        weightGrams: product.weightGrams ?? 1,
        stock: product.stock ?? 0,
        isActive: product.isActive ?? true,
        ratingAvg: product.ratingAvg ?? 0,
        ratingCount: product.ratingCount ?? 0,
        imageUrl: product.imageUrl ?? "",
      })),
    ),
  });

  // -------------------------------------------------------------- vehicles
  await prisma.vehicle.createMany({
    data: db.vehicles.map((vehicle: any) => ({
      id: vehicle.id,
      customerId: vehicle.customerId,
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber,
      color: vehicle.color,
      odometerKm: vehicle.odometerKm ?? 0,
      photoUrl: vehicle.photoUrl ?? null,
      reminderMonths: vehicle.reminderMonths ?? 6,
      reminderKm: vehicle.reminderKm ?? 5000,
      lastServiceAt: asDate(vehicle.lastServiceAt) ?? null,
      lastWorkshopName: vehicle.lastWorkshopName ?? null,
    })),
  });

  // --------------------------------------------------------- service orders
  await prisma.serviceOrder.createMany({
    data: db.serviceOrders.map((order: any) => ({
      id: order.id,
      code: order.code,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      workshopId: order.workshopId,
      workshopName: order.workshopName,
      workshopSlug: order.workshopSlug,
      workshopType: order.workshopType,
      vehicleId: order.vehicleId,
      vehicleLabel: order.vehicleLabel,
      plateNumber: order.plateNumber,
      status: order.status,
      scheduledAt: new Date(order.scheduledAt),
      complaint: order.complaint ?? "",
      customerNote: order.customerNote ?? null,
      odometerIn: order.odometerIn ?? 0,
      odometerOut: order.odometerOut ?? null,
      estimatedTotal: order.estimatedTotal ?? 0,
      finalTotal: order.finalTotal ?? null,
      mechanicNote: order.mechanicNote ?? null,
      mechanicIds: order.mechanicIds ?? [],
      mechanicNames: order.mechanicNames ?? [],
      items: json(order.items),
      photos: order.photos ?? [],
      createdAt: asDate(order.createdAt) ?? new Date(),
      startedAt: asDate(order.startedAt) ?? null,
      completedAt: asDate(order.completedAt) ?? null,
      paidAt: asDate(order.paidAt) ?? null,
      paymentMethod: order.paymentMethod ?? null,
      cancelReason: order.cancelReason ?? null,
      reviewId: order.reviewId ?? null,
    })),
  });

  // ---------------------------------------------------------------- orders
  for (const order of db.orders) {
    const payment = order.payment;
    await prisma.order.create({
      data: {
        id: order.id,
        code: order.code,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        workshopId: order.workshopId,
        workshopName: order.workshopName,
        workshopSlug: order.workshopSlug,
        status: order.status,
        fulfillment: order.fulfillment,
        shippingCost: order.shippingCost ?? 0,
        shipping: order.shipping ? json(order.shipping) : undefined,
        items: json(order.items),
        subtotal: order.subtotal ?? 0,
        discountTotal: order.discountTotal ?? 0,
        total: order.total ?? 0,
        pickupCode: order.pickupCode,
        expiresAt: new Date(order.expiresAt),
        createdAt: asDate(order.createdAt) ?? new Date(),
        paidAt: asDate(order.paidAt) ?? null,
        preparingAt: asDate(order.preparingAt) ?? null,
        readyAt: asDate(order.readyAt) ?? null,
        completedAt: asDate(order.completedAt) ?? null,
        cancelledAt: asDate(order.cancelledAt) ?? null,
        cancelReason: order.cancelReason ?? null,
        payment: payment
          ? {
              create: {
                id: payment.id,
                provider: payment.provider ?? "fake",
                method: payment.method,
                amount: payment.amount,
                status: payment.status ?? "pending",
                providerRef: payment.providerRef,
                vaNumber: payment.vaNumber ?? null,
                qrString: payment.qrString ?? null,
                expiresAt: new Date(payment.expiresAt),
                paidAt: asDate(payment.paidAt) ?? null,
              },
            }
          : undefined,
      },
    });
  }

  // --------------------------------------------------------------- reviews
  const workshopReviews = db.workshops.flatMap((workshop: any) =>
    (workshop.reviews ?? []).map((review: any) => ({
      id: review.id,
      customerId: review.customerId,
      customerName: review.customerName,
      workshopId: workshop.id,
      serviceOrderId: review.serviceOrderId ?? null,
      orderId: review.orderId ?? null,
      productId: review.productId ?? null,
      rating: review.rating,
      comment: review.comment ?? "",
      tags: review.tags ?? [],
      status: review.status ?? "published",
      workshopReply: review.workshopReply ?? null,
      repliedAt: asDate(review.repliedAt) ?? null,
      createdAt: asDate(review.createdAt) ?? new Date(),
    })),
  );

  const productReviews = (db.productReviews ?? []).map((review: any) => ({
    id: review.id,
    customerId: review.customerId,
    customerName: review.customerName,
    workshopId: review.workshopId,
    serviceOrderId: review.serviceOrderId ?? null,
    orderId: review.orderId ?? null,
    productId: review.productId ?? null,
    rating: review.rating,
    comment: review.comment ?? "",
    tags: review.tags ?? [],
    status: review.status ?? "published",
    workshopReply: review.workshopReply ?? null,
    repliedAt: asDate(review.repliedAt) ?? null,
    createdAt: asDate(review.createdAt) ?? new Date(),
  }));

  await prisma.review.createMany({ data: [...workshopReviews, ...productReviews] });

  // ----------------------------------------------------------- conversations
  await prisma.conversation.createMany({
    data: db.conversations.map((conversation: any) => ({
      id: conversation.id,
      customerId: conversation.customerId,
      customerName: conversation.customerName,
      workshopId: conversation.workshopId,
      workshopName: conversation.workshopName,
      workshopSlug: conversation.workshopSlug,
      lastMessageAt: asDate(conversation.lastMessageAt) ?? new Date(),
      createdAt: asDate(conversation.createdAt) ?? new Date(),
    })),
  });

  await prisma.message.createMany({
    data: db.messages.map((message: any) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      body: message.body ?? "",
      attachmentUrl: message.attachmentUrl ?? null,
      readAt: asDate(message.readAt) ?? null,
      deletedAt: asDate(message.deletedAt) ?? null,
      createdAt: asDate(message.createdAt) ?? new Date(),
    })),
  });

  // ----------------------------------------------------------- notifications
  await prisma.notification.createMany({
    data: db.notifications.map((notification: any) => ({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href ?? null,
      readAt: asDate(notification.readAt) ?? null,
      createdAt: asDate(notification.createdAt) ?? new Date(),
    })),
  });

  return {
    users: allUsers.length,
    workshops: db.workshops.length,
    services: db.workshops.reduce((n: number, w: any) => n + (w.services?.length ?? 0), 0),
    mechanics: db.workshops.reduce((n: number, w: any) => n + (w.mechanics?.length ?? 0), 0),
    products: db.workshops.reduce((n: number, w: any) => n + (w.products?.length ?? 0), 0),
    serviceOrders: db.serviceOrders.length,
    orders: db.orders.length,
    reviews: workshopReviews.length + productReviews.length,
    conversations: db.conversations.length,
    messages: db.messages.length,
    notifications: db.notifications.length,
  };
}
