import { asClosures, asHours, distanceKm, isOpenNow, nextSlotFor } from "./geo";

export function toIso(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function userJson(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    avatarUrl: user.avatarUrl ?? undefined,
    emailVerified: user.emailVerified,
    status: user.status,
    createdAt: toIso(user.createdAt),
  };
}

export function finalPrice(product: any) {
  if (product.discountType === "percent") {
    return Math.round(product.price * (1 - product.discountValue / 100));
  }
  if (product.discountType === "fixed") {
    return Math.max(0, product.price - product.discountValue);
  }
  return product.price;
}

export function productJson(product: any, options: { distanceKm?: number } = {}) {
  if (!product) return null;
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
    finalPrice: finalPrice(product),
    discountType: product.discountType,
    discountValue: product.discountValue,
    weightGrams: product.weightGrams,
    stock: product.stock,
    isActive: product.isActive,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    imageUrl: product.imageUrl,
    distanceKm: options.distanceKm,
  };
}

export function reviewJson(review: any) {
  if (!review) return null;
  return {
    id: review.id,
    customerId: review.customerId,
    customerName: review.customerName,
    workshopId: review.workshopId,
    serviceOrderId: review.serviceOrderId ?? undefined,
    orderId: review.orderId ?? undefined,
    productId: review.productId ?? undefined,
    rating: review.rating,
    comment: review.comment,
    tags: review.tags ?? [],
    status: review.status,
    workshopReply: review.workshopReply ?? undefined,
    repliedAt: toIso(review.repliedAt),
    createdAt: toIso(review.createdAt),
  };
}

export function mechanicJson(mechanic: any) {
  if (!mechanic) return null;
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

export function serviceJson(service: any) {
  if (!service) return null;
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

export function workshopJson(
  workshop: any,
  options: { publicView?: boolean; lat?: number; lng?: number; distanceKm?: number } = {},
) {
  if (!workshop) return null;
  const publicView = options.publicView !== false;
  const hours = asHours(workshop.hours);
  const closures = asClosures(workshop.closures);
  const services = (workshop.services ?? [])
    .filter((service: any) => !publicView || service.isActive)
    .map(serviceJson);
  const mechanics = (workshop.mechanics ?? [])
    .filter((mechanic: any) => !publicView || mechanic.isActive)
    .map(mechanicJson);
  const products = (workshop.products ?? [])
    .filter((product: any) => !publicView || product.isActive)
    .map((product: any) => productJson(product));
  const reviews = (workshop.reviews ?? [])
    .filter((review: any) => !review.productId)
    .filter((review: any) => !publicView || review.status === "published")
    .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map(reviewJson);

  const distance =
    options.distanceKm !== undefined
      ? options.distanceKm
      : options.lat !== undefined && options.lng !== undefined
        ? distanceKm(options.lat, options.lng, workshop.lat, workshop.lng)
        : undefined;

  return {
    id: workshop.id,
    ownerUserId: workshop.ownerUserId,
    name: workshop.name,
    slug: workshop.slug,
    description: workshop.description,
    workshopType: workshop.workshopType,
    phone: workshop.phone,
    email: workshop.email,
    addressLine: workshop.addressLine,
    city: workshop.city,
    province: workshop.province,
    postalCode: workshop.postalCode,
    countryCode: workshop.countryCode,
    lat: workshop.lat,
    lng: workshop.lng,
    timezone: workshop.timezone,
    coverUrl: workshop.coverUrl,
    logoUrl: workshop.logoUrl ?? undefined,
    gallery: workshop.gallery ?? [],
    status: workshop.status,
    ratingAvg: workshop.ratingAvg,
    ratingCount: workshop.ratingCount,
    distanceKm: distance,
    openNow: isOpenNow(hours, closures),
    nextSlot: nextSlotFor(hours, closures),
    hours,
    closures,
    slotCapacityPerHour: workshop.slotCapacityPerHour,
    services,
    mechanics,
    products,
    reviews,
    createdAt: toIso(workshop.createdAt),
  };
}

export function serviceOrderJson(order: any) {
  if (!order) return null;
  return {
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
    scheduledAt: toIso(order.scheduledAt),
    complaint: order.complaint,
    customerNote: order.customerNote ?? undefined,
    odometerIn: order.odometerIn,
    odometerOut: order.odometerOut ?? undefined,
    estimatedTotal: order.estimatedTotal,
    finalTotal: order.finalTotal ?? undefined,
    mechanicNote: order.mechanicNote ?? undefined,
    mechanicIds: order.mechanicIds ?? [],
    mechanicNames: order.mechanicNames ?? [],
    items: order.items ?? [],
    photos: order.photos ?? [],
    createdAt: toIso(order.createdAt),
    startedAt: toIso(order.startedAt),
    completedAt: toIso(order.completedAt),
    paidAt: toIso(order.paidAt),
    paymentMethod: order.paymentMethod ?? undefined,
    cancelReason: order.cancelReason ?? undefined,
    reviewId: order.reviewId ?? undefined,
    payment: paymentJson(order.payment),
  };
}

export function paymentJson(payment: any) {
  if (!payment) return null;
  return {
    id: payment.id,
    orderId: payment.orderId ?? undefined,
    serviceOrderId: payment.serviceOrderId ?? undefined,
    provider: payment.provider,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    providerRef: payment.providerRef,
    vaNumber: payment.vaNumber ?? undefined,
    qrString: payment.qrString ?? undefined,
    expiresAt: toIso(payment.expiresAt),
    paidAt: toIso(payment.paidAt),
  };
}

export function orderJson(order: any) {
  if (!order) return null;
  return {
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
    shippingCost: order.shippingCost,
    shipping: order.shipping ?? undefined,
    items: order.items ?? [],
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    total: order.total,
    pickupCode: order.pickupCode,
    expiresAt: toIso(order.expiresAt),
    createdAt: toIso(order.createdAt),
    paidAt: toIso(order.paidAt),
    preparingAt: toIso(order.preparingAt),
    readyAt: toIso(order.readyAt),
    completedAt: toIso(order.completedAt),
    cancelledAt: toIso(order.cancelledAt),
    cancelReason: order.cancelReason ?? undefined,
    payment: paymentJson(order.payment),
  };
}

export function cartJson(cart: any, items: any[]) {
  if (!cart) return null;
  return {
    id: cart.id,
    customerId: cart.customerId,
    workshopId: cart.workshopId,
    workshopName: cart.workshopName,
    workshopSlug: cart.workshopSlug,
    items,
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    updatedAt: toIso(cart.updatedAt),
  };
}

export function messageJson(message: any) {
  if (!message) return null;
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    senderName: message.senderName,
    senderRole: message.senderRole,
    body: message.body,
    attachmentUrl: message.attachmentUrl ?? undefined,
    readAt: toIso(message.readAt),
    deletedAt: toIso(message.deletedAt),
    createdAt: toIso(message.createdAt),
  };
}

export function conversationJson(
  conversation: any,
  extras: { lastMessage?: string; unreadCount?: number } = {},
) {
  if (!conversation) return null;
  return {
    id: conversation.id,
    customerId: conversation.customerId,
    customerName: conversation.customerName,
    workshopId: conversation.workshopId,
    workshopName: conversation.workshopName,
    workshopSlug: conversation.workshopSlug,
    lastMessageAt: toIso(conversation.lastMessageAt),
    lastMessage: extras.lastMessage,
    unreadCount: extras.unreadCount ?? 0,
  };
}

export function notificationJson(notification: any) {
  if (!notification) return null;
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href ?? undefined,
    readAt: toIso(notification.readAt),
    createdAt: toIso(notification.createdAt),
  };
}
