import { getSessionUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { courierById, courierName, shippingCostFor, totalWeight } from "@/lib/shipping";
import type {
  Cart,
  CartItem,
  CreateBookingInput,
  CreateOrderInput,
  CreateReviewInput,
  LoginInput,
  Mechanic,
  Message,
  Notification,
  Order,
  PaymentMethod,
  Product,
  ProductQuery,
  RegisterCustomerInput,
  RegisterWorkshopInput,
  Review,
  Service,
  ServiceOrder,
  ServiceOrderItem,
  User,
  Vehicle,
  Workshop,
  WorkshopDashboard,
  WorkshopQuery,
  WorkshopType,
} from "@/lib/api/types";
import { clamp, randomCode, slugify, uid } from "@/lib/utils";
import { DEMO_PASSWORD } from "./data";
import { getDb, mutateDb, resetDb } from "./db";

const WIB_OFFSET = "+07:00";

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180));
}

function actor(role?: User["role"]): User {
  const user = getSessionUser();
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  }
  if (role && user.role !== role) {
    throw new ApiError("FORBIDDEN", "You do not have access to this resource.", 403);
  }
  return user;
}

function findUser(id: string): User {
  const user = getDb().users.find((item) => item.id === id);
  if (!user) throw new ApiError("NOT_FOUND", "User not found.", 404);
  return user;
}

function findWorkshopByOwner(userId: string): Workshop {
  const workshop = getDb().workshops.find((item) => item.ownerUserId === userId);
  if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
  return workshop;
}

function publicWorkshop(workshop: Workshop, lat?: number, lng?: number): Workshop {
  return {
    ...workshop,
    distanceKm:
      lat !== undefined && lng !== undefined
        ? distanceKm(lat, lng, workshop.lat, workshop.lng)
        : undefined,
    openNow: isOpenNow(workshop),
    nextSlot: nextSlotFor(workshop),
    services: workshop.services.filter((service) => service.isActive),
    mechanics: workshop.mechanics.filter((mechanic) => mechanic.isActive),
    products: workshop.products.filter((product) => product.isActive),
    reviews: workshop.reviews
      .filter((review) => review.status === "published")
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    day: dayMap[get("weekday")] ?? new Date().getDay(),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isOpenNow(workshop: Workshop) {
  const now = jakartaNow();
  if (workshop.closures.some((closure) => closure.date === now.dateKey)) return false;
  const today = workshop.hours.find((hour) => hour.dayOfWeek === now.day);
  if (!today || today.isClosed) return false;
  const [openH, openM] = today.openTime.split(":").map(Number);
  const [closeH, closeM] = today.closeTime.split(":").map(Number);
  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;
  return now.minutes >= open && now.minutes < close;
}

function dateKeyInJakarta(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextSlotFor(workshop: Workshop) {
  const now = jakartaNow();
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000);
    const key = dateKeyInJakarta(date);
    if (workshop.closures.some((closure) => closure.date === key)) continue;
    const day = new Date(`${key}T12:00:00${WIB_OFFSET}`).getUTCDay();
    const hours = workshop.hours.find((hour) => hour.dayOfWeek === day);
    if (!hours || hours.isClosed) continue;
    const [openH] = hours.openTime.split(":").map(Number);
    const [closeH] = hours.closeTime.split(":").map(Number);
    for (let hour = openH; hour < closeH; hour += 1) {
      if (offset === 0 && hour * 60 <= now.minutes + 60) continue;
      return new Date(`${key}T${String(hour).padStart(2, "0")}:00:00${WIB_OFFSET}`).toISOString();
    }
  }
  return undefined;
}

function paginate<T>(items: T[], page = 1, perPage = 20) {
  const safePerPage = clamp(perPage, 1, 100);
  const start = (Math.max(1, page) - 1) * safePerPage;
  return {
    data: items.slice(start, start + safePerPage),
    meta: { page: Math.max(1, page), perPage: safePerPage, total: items.length },
  };
}

function finalPrice(product: Product) {
  if (product.discountType === "percent") {
    return Math.round(product.price * (1 - product.discountValue / 100));
  }
  if (product.discountType === "fixed") {
    return Math.max(0, product.price - product.discountValue);
  }
  return product.price;
}

function decorateProduct(product: Product, lat?: number, lng?: number): Product {
  const db = getDb();
  const workshop = db.workshops.find((item) => item.id === product.workshopId);
  return {
    ...product,
    finalPrice: finalPrice(product),
    distanceKm:
      workshop && lat !== undefined && lng !== undefined
        ? distanceKm(lat, lng, workshop.lat, workshop.lng)
        : undefined,
  };
}

function ensureCustomerOwnsVehicle(customerId: string, vehicleId: string) {
  const vehicle = getDb().vehicles.find(
    (item) => item.id === vehicleId && item.customerId === customerId,
  );
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
  return vehicle;
}

function ensureWorkshopOrderAccess(order: ServiceOrder, user: User) {
  if (order.customerId === user.id) return;
  if (user.role === "workshop_owner") {
    const workshop = findWorkshopByOwner(user.id);
    if (order.workshopId === workshop.id) return;
  }
  throw new ApiError("NOT_FOUND", "Booking not found.", 404);
}

function ensureOrderAccess(order: Order, user: User) {
  if (order.customerId === user.id) return;
  if (user.role === "workshop_owner") {
    const workshop = findWorkshopByOwner(user.id);
    if (order.workshopId === workshop.id) return;
  }
  throw new ApiError("NOT_FOUND", "Order not found.", 404);
}

function ensureConversationAccess(
  conversation: { customerId: string; workshopId: string },
  user: User,
) {
  if (conversation.customerId === user.id) return;
  if (user.role === "workshop_owner") {
    const workshop = findWorkshopByOwner(user.id);
    if (conversation.workshopId === workshop.id) return;
  }
  throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
}

function addNotification(
  db: ReturnType<typeof getDb>,
  userId: string,
  type: Notification["type"],
  title: string,
  body: string,
  href?: string,
) {
  db.notifications.unshift({
    id: uid("notif"),
    userId,
    type,
    title,
    body,
    href,
    createdAt: new Date().toISOString(),
  });
}

function updateVehicleAfterService(db: ReturnType<typeof getDb>, order: ServiceOrder) {
  if (order.odometerOut === undefined) return;
  const vehicle = db.vehicles.find((item) => item.id === order.vehicleId);
  if (!vehicle) return;
  vehicle.odometerKm = Math.max(vehicle.odometerKm, order.odometerOut);
  vehicle.lastServiceAt = new Date().toISOString();
  vehicle.lastWorkshopName = order.workshopName;
}

export const mockApi = {
  async login(input: LoginInput) {
    await wait();
    const db = getDb();
    const email = input.email.trim().toLowerCase();
    const user = db.users.find((item) => item.email.toLowerCase() === email);
    const password = db.passwords[email];
    if (!user || !password || input.password !== password) {
      throw new ApiError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    if (user.status === "suspended") {
      throw new ApiError("ACCOUNT_SUSPENDED", "This account is suspended.", 403);
    }
    return user;
  },

  async registerCustomer(input: RegisterCustomerInput) {
    await wait();
    return mutateDb((db) => {
      const email = input.email.trim().toLowerCase();
      if (db.users.some((item) => item.email.toLowerCase() === email)) {
        throw new ApiError("EMAIL_TAKEN", "This email is already registered.", 409);
      }
      const user: User = {
        id: uid("user"),
        email,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        role: "customer",
        locale: "en",
        emailVerified: false,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.passwords[email] = input.password;
      return user;
    });
  },

  async registerWorkshop(input: RegisterWorkshopInput) {
    await wait();
    return mutateDb((db) => {
      const email = input.email.trim().toLowerCase();
      if (db.users.some((item) => item.email.toLowerCase() === email)) {
        throw new ApiError("EMAIL_TAKEN", "This email is already registered.", 409);
      }
      const user: User = {
        id: uid("user"),
        email,
        fullName: input.ownerName.trim(),
        phone: input.phone.trim(),
        role: "workshop_owner",
        locale: "en",
        emailVerified: false,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const workshopId = uid("ws");
      const slug = slugify(input.workshopName) || workshopId;
      const workshop: Workshop = {
        id: workshopId,
        ownerUserId: user.id,
        name: input.workshopName.trim(),
        slug,
        description: "",
        workshopType: input.workshopType,
        phone: input.phone,
        email,
        addressLine: input.addressLine,
        city: input.city,
        province: "",
        postalCode: "",
        countryCode: "ID",
        lat: input.lat,
        lng: input.lng,
        timezone: "Asia/Jakarta",
        coverUrl: "",
        gallery: [],
        status: "draft",
        ratingAvg: 0,
        ratingCount: 0,
        hours: Array.from({ length: 7 }).map((_, day) => ({
          dayOfWeek: day,
          openTime: "08:00",
          closeTime: "18:00",
          isClosed: day === 0,
        })),
        closures: [],
        slotCapacityPerHour: 1,
        services: [],
        mechanics: [],
        products: [],
        reviews: [],
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.passwords[email] = input.password;
      db.workshops.push(workshop);
      return user;
    });
  },

  async me() {
    await wait();
    return actor();
  },

  async verifyEmail(userId: string) {
    await wait();
    return mutateDb((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError("NOT_FOUND", "User not found.", 404);
      user.emailVerified = true;
      return user;
    });
  },

  async updateLocale(locale: "en" | "id") {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const found = db.users.find((item) => item.id === user.id);
      if (!found) throw new ApiError("NOT_FOUND", "User not found.", 404);
      found.locale = locale;
      return found;
    });
  },

  async listWorkshops(query: WorkshopQuery = {}) {
    await wait();
    const db = getDb();
    const lat = query.lat;
    const lng = query.lng;
    let items = db.workshops
      .filter((workshop) => workshop.status === "active")
      .map((workshop) => publicWorkshop(workshop, lat, lng));

    if (query.type && query.type !== "all") {
      items = items.filter((workshop) => workshop.workshopType === query.type);
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (workshop) =>
          workshop.name.toLowerCase().includes(q) ||
          workshop.city.toLowerCase().includes(q) ||
          workshop.addressLine.toLowerCase().includes(q),
      );
    }
    if (query.openNow) {
      items = items.filter((workshop) => workshop.openNow);
    }
    if (query.minRating) {
      items = items.filter((workshop) => workshop.ratingAvg >= query.minRating!);
    }
    if (query.radius && lat !== undefined && lng !== undefined) {
      items = items.filter((workshop) => (workshop.distanceKm ?? 0) <= query.radius!);
    }

    items.sort((a, b) => {
      if (query.sort === "rating") return b.ratingAvg - a.ratingAvg;
      if (query.sort === "name") return a.name.localeCompare(b.name);
      return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    });

    return paginate(items, query.page, query.perPage);
  },

  async getWorkshop(slug: string, lat?: number, lng?: number) {
    await wait();
    const workshop = getDb().workshops.find(
      (item) => item.slug === slug && item.status === "active",
    );
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    return publicWorkshop(workshop, lat, lng);
  },

  async getAvailability(workshopId: string, date: string) {
    await wait();
    const db = getDb();
    const workshop = db.workshops.find((item) => item.id === workshopId);
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    const day = new Date(`${date}T12:00:00${WIB_OFFSET}`).getUTCDay();
    const hours = workshop.hours.find((hour) => hour.dayOfWeek === day);
    if (!hours || hours.isClosed) return [];
    if (workshop.closures.some((closure) => closure.date === date)) return [];
    const [openH] = hours.openTime.split(":").map(Number);
    const [closeH] = hours.closeTime.split(":").map(Number);
    const slots: { time: string; iso: string; available: boolean; remaining: number }[] = [];
    for (let hour = openH; hour < closeH; hour += 1) {
      const iso = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00${WIB_OFFSET}`).toISOString();
      const active = db.serviceOrders.filter(
        (order) =>
          order.workshopId === workshopId &&
          ["confirmed", "in_progress"].includes(order.status) &&
          dateKeyInJakarta(new Date(order.scheduledAt)) === date &&
          new Date(order.scheduledAt).getUTCHours() === new Date(iso).getUTCHours(),
      ).length;
      const leadTimeOk = new Date(iso).getTime() > Date.now() + 60 * 60 * 1000;
      const remaining = Math.max(0, workshop.slotCapacityPerHour - active);
      slots.push({
        time: `${String(hour).padStart(2, "0")}:00`,
        iso,
        available: remaining > 0 && leadTimeOk,
        remaining,
      });
    }
    return slots;
  },

  async listProducts(query: ProductQuery = {}) {
    await wait();
    const db = getDb();
    const activeWorkshopIds = new Set(
      db.workshops.filter((workshop) => workshop.status === "active").map((workshop) => workshop.id),
    );
    let items = db.workshops
      .flatMap((workshop) => workshop.products)
      .filter((product) => product.isActive && activeWorkshopIds.has(product.workshopId))
      .map((product) => decorateProduct(product));
    if (query.workshopId) {
      items = items.filter((product) => product.workshopId === query.workshopId);
    }
    if (query.workshopType && query.workshopType !== "all") {
      items = items.filter((product) => product.workshopType === query.workshopType);
    }
    if (query.category && query.category !== "all") {
      items = items.filter((product) => product.category === query.category);
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (product) =>
          product.title.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          product.workshopName.toLowerCase().includes(q),
      );
    }
    if (query.minPrice !== undefined) {
      items = items.filter((product) => product.finalPrice >= query.minPrice!);
    }
    if (query.maxPrice !== undefined) {
      items = items.filter((product) => product.finalPrice <= query.maxPrice!);
    }
    if (query.sort === "price_asc") items.sort((a, b) => a.finalPrice - b.finalPrice);
    else if (query.sort === "price_desc") items.sort((a, b) => b.finalPrice - a.finalPrice);
    else if (query.sort === "rating") items.sort((a, b) => b.ratingAvg - a.ratingAvg);
    else items.sort((a, b) => b.id.localeCompare(a.id));
    return paginate(items, query.page, query.perPage);
  },

  async getProduct(slug: string) {
    await wait();
    const product = getDb()
      .workshops.flatMap((workshop) => workshop.products)
      .find((item) => item.slug === slug);
    if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
    return decorateProduct(product);
  },

  async listCarts() {
    await wait();
    const user = actor();
    const db = getDb();
    return db.carts
      .filter((cart) => cart.customerId === user.id && cart.items.length > 0)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .map((cart) => hydrateCart(cart, db));
  },

  async addToCart(workshopId: string, productId: string, qty = 1) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.id === workshopId);
      const product = workshop?.products.find((item) => item.id === productId);
      if (!workshop || !product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
      if (!product.isActive) throw new ApiError("PRODUCT_UNAVAILABLE", "This product is unavailable.", 409);
      if (product.stock < 1) throw new ApiError("OUT_OF_STOCK", "This product is out of stock.", 409);
      let cart = db.carts.find((item) => item.customerId === user.id && item.workshopId === workshopId);
      if (!cart) {
        cart = {
          id: uid("cart"),
          customerId: user.id,
          workshopId,
          workshopName: workshop.name,
          workshopSlug: workshop.slug,
          items: [],
          subtotal: 0,
          updatedAt: new Date().toISOString(),
        };
        db.carts.push(cart);
      }
      const existingItem = cart.items.find((item) => item.productId === productId);
      const nextQty = clamp((existingItem?.qty ?? 0) + qty, 1, product.stock);
      if (existingItem) {
        existingItem.qty = nextQty;
        existingItem.subtotal = nextQty * product.finalPrice;
      } else {
        cart.items.push({
          id: uid("cart-item"),
          productId,
          product,
          qty: nextQty,
          subtotal: nextQty * product.finalPrice,
        });
      }
      cart.updatedAt = new Date().toISOString();
      cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
      return hydrateCart(cart, db);
    });
  },

  async updateCartItem(itemId: string, qty: number) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const cart = db.carts.find(
        (entry) => entry.customerId === user.id && entry.items.some((item) => item.id === itemId),
      );
      if (!cart) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
      const item = cart.items.find((entry) => entry.id === itemId);
      if (!item) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
      if (qty <= 0) {
        cart.items = cart.items.filter((entry) => entry.id !== itemId);
      } else {
        const product = db.workshops
          .flatMap((workshop) => workshop.products)
          .find((entry) => entry.id === item.productId);
        if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
        item.qty = clamp(qty, 1, product.stock);
        item.subtotal = item.qty * product.finalPrice;
      }
      cart.subtotal = cart.items.reduce((sum, entry) => sum + entry.subtotal, 0);
      cart.updatedAt = new Date().toISOString();
      return hydrateCart(cart, db);
    });
  },

  async removeCartItem(itemId: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const cart = db.carts.find(
        (entry) => entry.customerId === user.id && entry.items.some((item) => item.id === itemId),
      );
      if (!cart) throw new ApiError("NOT_FOUND", "Cart item not found.", 404);
      cart.items = cart.items.filter((entry) => entry.id !== itemId);
      cart.subtotal = cart.items.reduce((sum, entry) => sum + entry.subtotal, 0);
      cart.updatedAt = new Date().toISOString();
      if (cart.items.length === 0) {
        db.carts = db.carts.filter((entry) => entry.id !== cart.id);
        return null;
      }
      return hydrateCart(cart, db);
    });
  },

  async clearCart(workshopId: string) {
    await wait();
    const user = actor();
    mutateDb((db) => {
      db.carts = db.carts.filter(
        (cart) => !(cart.customerId === user.id && cart.workshopId === workshopId),
      );
    });
    return null;
  },

  async createOrder(input: CreateOrderInput) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const cart = db.carts.find(
        (item) => item.customerId === user.id && item.workshopId === input.workshopId,
      );
      if (!cart || cart.items.length === 0) {
        throw new ApiError("CART_EMPTY", "Your cart is empty.", 400);
      }
      const workshop = db.workshops.find((item) => item.id === input.workshopId);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      for (const item of cart.items) {
        const product = workshop.products.find((entry) => entry.id === item.productId);
        if (!product || !product.isActive) {
          throw new ApiError("PRODUCT_UNAVAILABLE", `${item.product.title} is unavailable.`, 409);
        }
        if (product.stock < item.qty) {
          throw new ApiError("STOCK_CHANGED", `${item.product.title} only has ${product.stock} left.`, 409);
        }
      }
      const orderId = uid("ord");
      const weightGrams = totalWeight(
        cart.items.map((item) => ({ weightGrams: item.product.weightGrams, qty: item.qty })),
      );
      const fulfillment = input.fulfillment;
      let shippingCost = 0;
      let shipping: Order["shipping"];
      if (fulfillment === "expedition") {
        const address = input.shipping?.address;
        if (
          !input.shipping?.courier ||
          !address?.recipient.trim() ||
          !address?.line.trim() ||
          !address?.city.trim() ||
          !address?.postalCode.trim()
        ) {
          throw new ApiError("INVALID_SHIPPING", "Complete the delivery address first.", 400);
        }
        const courier = courierById(input.shipping.courier);
        shippingCost = shippingCostFor(courier.id, weightGrams);
        shipping = {
          courier: courier.id,
          service: courier.service,
          cost: shippingCost,
          address: {
            recipient: address.recipient.trim(),
            phone: input.customerPhone,
            line: address.line.trim(),
            city: address.city.trim(),
            postalCode: address.postalCode.trim(),
          },
        };
      }
      const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal + shippingCost;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const order: Order = {
        id: orderId,
        code: randomCode("ORD"),
        customerId: user.id,
        customerName: user.fullName,
        customerPhone: input.customerPhone,
        workshopId: workshop.id,
        workshopName: workshop.name,
        workshopSlug: workshop.slug,
        status: "pending_payment",
        fulfillment,
        shippingCost,
        shipping,
        items: cart.items.map((item) => ({
          id: uid("order-item"),
          productId: item.productId,
          titleSnapshot: item.product.title,
          unitPrice: item.product.finalPrice,
          qty: item.qty,
          subtotal: item.subtotal,
          weightGrams: item.product.weightGrams,
          imageUrl: item.product.imageUrl,
        })),
        subtotal,
        discountTotal: 0,
        total,
        pickupCode: randomCode("", 6).replace("-", "").slice(0, 6),
        expiresAt,
        createdAt: new Date().toISOString(),
        payment: {
          id: uid("pay"),
          orderId,
          provider: "fake",
          method: input.paymentMethod,
          amount: total,
          status: "pending",
          providerRef: `FAKE-${randomCode("", 8).replace("-", "")}`,
          vaNumber:
            input.paymentMethod === "va"
              ? `8808 ${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)}`
              : undefined,
          qrString:
            input.paymentMethod === "qris"
              ? `00020101021226${randomCode("", 8).replace("-", "")}5802ID`
              : undefined,
          expiresAt,
        },
      };
      for (const item of cart.items) {
        const product = workshop.products.find((entry) => entry.id === item.productId);
        if (product) product.stock -= item.qty;
      }
      db.orders.unshift(order);
      db.carts = db.carts.filter((item) => item.id !== cart.id);
      addNotification(
        db,
        workshop.ownerUserId,
        "order_created",
        "New shop order",
        `${user.fullName} placed a ${fulfillment === "expedition" ? "delivery" : "pickup"} order at ${workshop.name}.`,
        "/workshop/orders",
      );
      return order;
    });
  },

  async listOrders() {
    await wait();
    const user = actor();
    const db = getDb();
    return db.orders
      .filter((order) => order.customerId === user.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getOrder(id: string) {
    await wait();
    const user = actor();
    const order = getDb().orders.find((item) => item.id === id);
    if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
    ensureOrderAccess(order, user);
    return order;
  },

  async cancelOrder(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id && item.customerId === user.id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.status !== "pending_payment") {
        throw new ApiError("INVALID_TRANSITION", "This order can no longer be cancelled.", 409);
      }
      order.status = "cancelled";
      order.cancelledAt = new Date().toISOString();
      order.cancelReason = "Cancelled by customer";
      order.payment.status = "failed";
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      if (workshop) {
        for (const item of order.items) {
          const product = workshop.products.find((entry) => entry.id === item.productId);
          if (product) product.stock += item.qty;
        }
      }
      return order;
    });
  },

  async simulateOrderPayment(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      ensureOrderAccess(order, user);
      if (order.status === "paid") return order;
      if (order.status !== "pending_payment") {
        throw new ApiError("INVALID_TRANSITION", "This order can no longer be paid.", 409);
      }
      if (order.payment.status !== "pending") {
        throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
      }
      if (new Date(order.payment.expiresAt) <= new Date()) {
        throw new ApiError("PAYMENT_EXPIRED", "The payment window has closed.", 409);
      }
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      order.payment.status = "paid";
      order.payment.paidAt = new Date().toISOString();
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      if (workshop) {
        addNotification(
          db,
          workshop.ownerUserId,
          "order_paid",
          "Order paid",
          `${order.customerName} paid ${order.code}. Prepare it for pickup.`,
          `/workshop/orders/${order.id}`,
        );
      }
      return order;
    });
  },

  async reviewProduct(input: CreateReviewInput) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.orders.find(
        (item) => item.id === input.orderId && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "Reviews open after pickup is complete.", 409);
      }
      const item = order.items.find((entry) => entry.productId === input.productId);
      if (!item) throw new ApiError("NOT_FOUND", "Order item not found.", 404);
      if (item.reviewed) throw new ApiError("ALREADY_REVIEWED", "This item is already reviewed.", 409);
      const review: Review = {
        id: uid("prev"),
        customerId: user.id,
        customerName: user.fullName,
        workshopId: order.workshopId,
        orderId: order.id,
        productId: input.productId,
        rating: input.rating,
        comment: input.comment,
        tags: input.tags ?? [],
        status: "published",
        createdAt: new Date().toISOString(),
      };
      db.productReviews.unshift(review);
      item.reviewed = true;
      const product = db.workshops
        .flatMap((workshop) => workshop.products)
        .find((entry) => entry.id === input.productId);
      if (product) {
        const total = product.ratingAvg * product.ratingCount + input.rating;
        product.ratingCount += 1;
        product.ratingAvg = Math.round((total / product.ratingCount) * 10) / 10;
      }
      return review;
    });
  },

  async listVehicles() {
    await wait();
    const user = actor();
    return getDb().vehicles.filter((vehicle) => vehicle.customerId === user.id);
  },

  async getVehicle(id: string) {
    await wait();
    const user = actor();
    const vehicle = getDb().vehicles.find(
      (item) => item.id === id && item.customerId === user.id,
    );
    if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
    return vehicle;
  },

  async createVehicle(input: Omit<Vehicle, "id" | "customerId">) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      if (
        db.vehicles.some(
          (vehicle) =>
            vehicle.customerId === user.id &&
            vehicle.plateNumber.toLowerCase() === input.plateNumber.toLowerCase(),
        )
      ) {
        throw new ApiError("PLATE_TAKEN", "This plate is already registered.", 409);
      }
      const vehicle: Vehicle = {
        ...input,
        id: uid("veh"),
        customerId: user.id,
        plateNumber: input.plateNumber.toUpperCase(),
      };
      db.vehicles.push(vehicle);
      return vehicle;
    });
  },

  async updateVehicle(id: string, input: Partial<Vehicle>) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const vehicle = db.vehicles.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
      Object.assign(vehicle, {
        brand: input.brand ?? vehicle.brand,
        model: input.model ?? vehicle.model,
        year: input.year ?? vehicle.year,
        plateNumber: input.plateNumber?.toUpperCase() ?? vehicle.plateNumber,
        color: input.color ?? vehicle.color,
        photoUrl: input.photoUrl ?? vehicle.photoUrl,
        reminderMonths: input.reminderMonths ?? vehicle.reminderMonths,
        reminderKm: input.reminderKm ?? vehicle.reminderKm,
        type: input.type ?? vehicle.type,
      });
      return vehicle;
    });
  },

  async deleteVehicle(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const vehicle = db.vehicles.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
      if (db.serviceOrders.some((order) => order.vehicleId === id)) {
        throw new ApiError("VEHICLE_HAS_HISTORY", "This vehicle has service history and cannot be deleted.", 409);
      }
      db.vehicles = db.vehicles.filter((item) => item.id !== id);
      return { ok: true };
    });
  },

  async listServiceOrders() {
    await wait();
    const user = actor();
    const db = getDb();
    return db.serviceOrders
      .filter((order) => order.customerId === user.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getServiceOrder(id: string) {
    await wait();
    const user = actor();
    const order = getDb().serviceOrders.find((item) => item.id === id);
    if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
    ensureWorkshopOrderAccess(order, user);
    return order;
  },

  async createBooking(input: CreateBookingInput) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.id === input.workshopId);
      if (!workshop || workshop.status !== "active") {
        throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      }
      const vehicle = ensureCustomerOwnsVehicle(user.id, input.vehicleId);
      if (vehicle.type !== workshop.workshopType) {
        throw new ApiError("VEHICLE_TYPE_MISMATCH", "This workshop does not service that vehicle type.", 422);
      }
      if (input.odometer < vehicle.odometerKm) {
        throw new ApiError("ODOMETER_TOO_LOW", "Odometer cannot be lower than the last record.", 422);
      }
      if (input.complaint.trim().length < 10) {
        throw new ApiError("VALIDATION_ERROR", "Please describe the complaint in at least 10 characters.", 422);
      }
      const services = workshop.services.filter((service) =>
        input.serviceIds.includes(service.id),
      );
      if (services.length === 0) {
        throw new ApiError("VALIDATION_ERROR", "Choose at least one service.", 422);
      }
      const scheduled = new Date(input.scheduledAt);
      if (scheduled.getTime() < Date.now() + 60 * 60 * 1000) {
        throw new ApiError("SLOT_FULL", "Choose a slot at least one hour from now.", 409);
      }
      const orderId = uid("so");
      const items: ServiceOrderItem[] = services.map((service) => ({
        id: uid("soi"),
        kind: service.kind,
        name: service.name,
        qty: 1,
        unitPrice: service.price,
        subtotal: service.price,
      }));
      const order: ServiceOrder = {
        id: orderId,
        code: randomCode("SO"),
        customerId: user.id,
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
        scheduledAt: input.scheduledAt,
        complaint: input.complaint,
        customerNote: input.customerNote,
        odometerIn: input.odometer,
        estimatedTotal: items.reduce((sum, item) => sum + item.subtotal, 0),
        mechanicIds: [],
        mechanicNames: [],
        items,
        photos: [],
        createdAt: new Date().toISOString(),
      };
      db.serviceOrders.unshift(order);
      addNotification(
        db,
        workshop.ownerUserId,
        "booking_requested",
        "New booking request",
        `${user.fullName} requested a slot for ${vehicle.brand} ${vehicle.model}.`,
        "/workshop/bookings",
      );
      addNotification(
        db,
        user.id,
        "booking_requested",
        "Booking requested",
        `${workshop.name} received your request. You will be notified when it is confirmed.`,
        `/bookings/${order.id}`,
      );
      return order;
    });
  },

  async cancelBooking(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      ensureWorkshopOrderAccess(order, user);
      if (!["requested", "confirmed"].includes(order.status)) {
        throw new ApiError("INVALID_TRANSITION", "This booking can no longer be cancelled.", 409);
      }
      const hours = (new Date(order.scheduledAt).getTime() - Date.now()) / 3_600_000;
      if (user.role === "customer" && hours < 2) {
        throw new ApiError("CANCELLATION_WINDOW_CLOSED", "Contact the workshop to cancel this slot.", 409);
      }
      order.status = "cancelled";
      order.cancelReason = user.role === "customer" ? "Cancelled by customer" : "Cancelled by workshop";
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      if (workshop) {
        addNotification(
          db,
          workshop.ownerUserId,
          "booking_declined",
          "Booking cancelled",
          `${order.customerName} cancelled ${order.code}.`,
          "/workshop/bookings",
        );
      }
      return order;
    });
  },

  async approveEstimate(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "awaiting_approval") {
        throw new ApiError("INVALID_TRANSITION", "There is no estimate to approve.", 409);
      }
      order.status = "completed";
      order.completedAt = new Date().toISOString();
      updateVehicleAfterService(db, order);
      return order;
    });
  },

  async rejectEstimate(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "awaiting_approval") {
        throw new ApiError("INVALID_TRANSITION", "There is no estimate to reject.", 409);
      }
      order.status = "in_progress";
      order.mechanicNote = "Customer rejected the revised estimate. The workshop is reviewing the items.";
      return order;
    });
  },

  async payServiceOrder(id: string, method: PaymentMethod) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status === "paid") return order;
      if (order.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
      }

      const now = new Date();
      const paidAt = now.toISOString();
      const amount = order.finalTotal ?? order.estimatedTotal;

      if (method === "cash") {
        order.status = "paid";
        order.paymentMethod = "cash";
        order.paidAt = paidAt;
        order.payment = {
          id: order.payment?.id ?? uid("pay"),
          serviceOrderId: order.id,
          provider: "cash",
          method: "cash",
          amount,
          status: "paid",
          providerRef: uid("cash"),
          expiresAt: paidAt,
          paidAt,
        };
        updateVehicleAfterService(db, order);
        const workshop = db.workshops.find((item) => item.id === order.workshopId);
        if (workshop) {
          addNotification(
            db,
            workshop.ownerUserId,
            "service_paid",
            "Service paid",
            `${order.customerName} paid ${order.code}.`,
            `/workshop/service-orders/${order.id}`,
          );
        }
        return order;
      }

      if (order.payment?.status === "pending" && new Date(order.payment.expiresAt) > now) {
        return order;
      }

      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      order.payment = {
        id: order.payment?.id ?? uid("pay"),
        serviceOrderId: order.id,
        provider: "fake",
        method,
        amount,
        status: "pending",
        providerRef: `FAKE-${randomCode("", 8).replace("-", "")}`,
        vaNumber:
          method === "va" || method === "bank_transfer"
            ? `8808 ${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)}`
            : undefined,
        qrString:
          method === "qris"
            ? `00020101021226${randomCode("", 8).replace("-", "")}5802ID`
            : undefined,
        expiresAt,
      };
      return order;
    });
  },

  async simulateServicePayment(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find(
        (item) => item.id === id && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status === "paid") return order;
      if (order.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "This invoice is not ready to pay.", 409);
      }
      if (!order.payment) {
        throw new ApiError("INVALID_TRANSITION", "Create a payment first.", 409);
      }
      if (order.payment.status !== "pending") {
        throw new ApiError("INVALID_TRANSITION", "This payment is no longer pending.", 409);
      }
      if (new Date(order.payment.expiresAt) <= new Date()) {
        throw new ApiError("PAYMENT_EXPIRED", "The payment window has closed.", 409);
      }

      const paidAt = new Date().toISOString();
      order.payment.status = "paid";
      order.payment.paidAt = paidAt;
      order.status = "paid";
      order.paymentMethod = order.payment.method;
      order.paidAt = paidAt;
      updateVehicleAfterService(db, order);
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      if (workshop) {
        addNotification(
          db,
          workshop.ownerUserId,
          "service_paid",
          "Service paid",
          `${order.customerName} paid ${order.code}.`,
          `/workshop/service-orders/${order.id}`,
        );
      }
      return order;
    });
  },

  async reviewWorkshop(input: CreateReviewInput) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.serviceOrders.find(
        (item) => item.id === input.serviceOrderId && item.customerId === user.id,
      );
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "paid") {
        throw new ApiError("INVALID_TRANSITION", "Reviews open after the service is paid.", 409);
      }
      if (order.reviewId) throw new ApiError("ALREADY_REVIEWED", "This service is already reviewed.", 409);
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const review: Review = {
        id: uid("rev"),
        customerId: user.id,
        customerName: user.fullName,
        workshopId: workshop.id,
        serviceOrderId: order.id,
        rating: input.rating,
        comment: input.comment,
        tags: input.tags ?? [],
        status: "published",
        createdAt: new Date().toISOString(),
      };
      workshop.reviews.unshift(review);
      const total = workshop.ratingAvg * workshop.ratingCount + input.rating;
      workshop.ratingCount += 1;
      workshop.ratingAvg = Math.round((total / workshop.ratingCount) * 10) / 10;
      order.reviewId = review.id;
      return review;
    });
  },

  async getWorkshopMe() {
    await wait();
    const user = actor("workshop_owner");
    return findWorkshopByOwner(user.id);
  },

  async updateWorkshop(input: Partial<Workshop>) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      Object.assign(workshop, input, { ownerUserId: user.id, id: workshop.id, slug: workshop.slug });
      const complete =
        workshop.name &&
        workshop.workshopType &&
        workshop.phone &&
        workshop.addressLine &&
        workshop.coverUrl &&
        workshop.hours.some((hour) => !hour.isClosed) &&
        user.emailVerified;
      workshop.status = complete ? "active" : "draft";
      return workshop;
    });
  },

  async listMechanics() {
    await wait();
    const user = actor("workshop_owner");
    return findWorkshopByOwner(user.id).mechanics;
  },

  async createMechanic(input: Omit<Mechanic, "id" | "workshopId">) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const mechanic: Mechanic = { ...input, id: uid("mech"), workshopId: workshop.id };
      workshop.mechanics.push(mechanic);
      return mechanic;
    });
  },

  async updateMechanic(id: string, input: Partial<Mechanic>) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      const mechanic = workshop?.mechanics.find((item) => item.id === id);
      if (!mechanic) throw new ApiError("NOT_FOUND", "Mechanic not found.", 404);
      Object.assign(mechanic, input, { id: mechanic.id, workshopId: mechanic.workshopId });
      return mechanic;
    });
  },

  async deleteMechanic(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      workshop.mechanics = workshop.mechanics.filter((item) => item.id !== id);
      return { ok: true };
    });
  },

  async listWorkshopServices() {
    await wait();
    const user = actor("workshop_owner");
    return findWorkshopByOwner(user.id).services;
  },

  async createWorkshopService(input: Omit<Service, "id" | "workshopId">) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const service: Service = { ...input, id: uid("svc"), workshopId: workshop.id };
      workshop.services.push(service);
      return service;
    });
  },

  async updateWorkshopService(id: string, input: Partial<Service>) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      const service = workshop?.services.find((item) => item.id === id);
      if (!service) throw new ApiError("NOT_FOUND", "Service not found.", 404);
      Object.assign(service, input, { id: service.id, workshopId: service.workshopId });
      return service;
    });
  },

  async deleteWorkshopService(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      workshop.services = workshop.services.filter((item) => item.id !== id);
      return { ok: true };
    });
  },

  async listWorkshopProducts() {
    await wait();
    const user = actor("workshop_owner");
    return findWorkshopByOwner(user.id).products;
  },

  async createWorkshopProduct(input: Partial<Product>) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const price = input.price ?? 1;
      const discountType = input.discountType ?? "none";
      const discountValue = input.discountValue ?? 0;
      const product: Product = {
        id: uid("prod"),
        workshopId: workshop.id,
        workshopSlug: workshop.slug,
        workshopName: workshop.name,
        workshopType: workshop.workshopType,
        title: input.title ?? "New product",
        slug: slugify(input.title ?? `new-product-${Date.now()}`),
        description: input.description ?? "",
        category: input.category ?? "other",
        brand: input.brand ?? "",
        partNumber: input.partNumber ?? "",
        price,
        finalPrice: finalPrice({
          price,
          discountType,
          discountValue,
        } as Product),
        discountType,
        discountValue,
        weightGrams: input.weightGrams ?? 1,
        stock: input.stock ?? 0,
        isActive: input.isActive ?? true,
        ratingAvg: 0,
        ratingCount: 0,
        imageUrl: input.imageUrl ?? "",
      };
      workshop.products.push(product);
      return product;
    });
  },

  async updateWorkshopProduct(id: string, input: Partial<Product>) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      const product = workshop?.products.find((item) => item.id === id);
      if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
      Object.assign(product, input, {
        id: product.id,
        workshopId: product.workshopId,
        workshopSlug: product.workshopSlug,
        workshopName: product.workshopName,
        workshopType: product.workshopType,
      });
      product.finalPrice = finalPrice(product);
      return product;
    });
  },

  async deleteWorkshopProduct(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const product = workshop.products.find((item) => item.id === id);
      if (product) product.isActive = false;
      return { ok: true };
    });
  },

  async getWorkshopBookings(status?: string) {
    await wait();
    const user = actor("workshop_owner");
    const workshop = findWorkshopByOwner(user.id);
    return getDb().serviceOrders
      .filter((order) => order.workshopId === workshop.id)
      .filter((order) => (status ? order.status === status : true))
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  },

  async confirmBooking(id: string, estimatedTotal: number) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "requested") {
        throw new ApiError("INVALID_TRANSITION", "Only requested bookings can be confirmed.", 409);
      }
      order.status = "confirmed";
      order.estimatedTotal = estimatedTotal;
      addNotification(
        db,
        order.customerId,
        "booking_confirmed",
        "Booking confirmed",
        `${order.workshopName} confirmed ${order.code} with an estimate of Rp ${estimatedTotal.toLocaleString("id-ID")}.`,
        `/bookings/${order.id}`,
      );
      return order;
    });
  },

  async declineBooking(id: string, reason: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "requested") {
        throw new ApiError("INVALID_TRANSITION", "Only requested bookings can be declined.", 409);
      }
      order.status = "declined";
      order.cancelReason = reason;
      addNotification(
        db,
        order.customerId,
        "booking_declined",
        "Booking declined",
        `${order.workshopName} declined ${order.code}: ${reason}`,
        `/bookings/${order.id}`,
      );
      return order;
    });
  },

  async startService(id: string, odometerIn: number, mechanicIds: string[]) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "confirmed") {
        throw new ApiError("INVALID_TRANSITION", "Only confirmed bookings can start.", 409);
      }
      const mechanics = workshop.mechanics.filter(
        (mechanic) => mechanicIds.includes(mechanic.id) && mechanic.isActive,
      );
      if (mechanics.length === 0) {
        throw new ApiError("VALIDATION_ERROR", "Assign at least one active mechanic.", 422);
      }
      order.status = "in_progress";
      order.odometerIn = odometerIn;
      order.startedAt = new Date().toISOString();
      order.mechanicIds = mechanics.map((mechanic) => mechanic.id);
      order.mechanicNames = mechanics.map((mechanic) => mechanic.name);
      addNotification(
        db,
        order.customerId,
        "service_started",
        "Service started",
        `${order.workshopName} started work on ${order.vehicleLabel}.`,
        `/bookings/${order.id}`,
      );
      return order;
    });
  },

  async completeService(
    id: string,
    input: {
      items: ServiceOrderItem[];
      photos: string[];
      mechanicNote: string;
      finalTotal: number;
    },
  ) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "in_progress") {
        throw new ApiError("INVALID_TRANSITION", "Only in-progress services can be completed.", 409);
      }
      if (input.items.length === 0 || input.finalTotal <= 0) {
        throw new ApiError("VALIDATION_ERROR", "Add at least one invoice item.", 422);
      }
      order.items = input.items;
      order.photos = input.photos;
      order.mechanicNote = input.mechanicNote;
      order.finalTotal = input.finalTotal;
      order.odometerOut = order.odometerIn;
      const needsApproval = input.finalTotal > order.estimatedTotal * 1.5;
      order.status = needsApproval ? "awaiting_approval" : "completed";
      order.completedAt = new Date().toISOString();
      if (!needsApproval) updateVehicleAfterService(db, order);
      addNotification(
        db,
        order.customerId,
        needsApproval ? "estimate_approval" : "service_completed",
        needsApproval ? "Estimate needs approval" : "Service completed",
        needsApproval
          ? `${order.workshopName} revised the invoice above your estimate. Review it before work continues.`
          : `${order.workshopName} completed ${order.code}. Your invoice is ready.`,
        `/bookings/${order.id}`,
      );
      return order;
    });
  },

  async markCashPaid(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "completed") {
        throw new ApiError("INVALID_TRANSITION", "Cash can only be recorded for a completed service.", 409);
      }
      order.status = "paid";
      order.paymentMethod = "cash";
      order.paidAt = new Date().toISOString();
      updateVehicleAfterService(db, order);
      return order;
    });
  },

  async markNoShow(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.serviceOrders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Booking not found.", 404);
      if (order.status !== "confirmed") {
        throw new ApiError("INVALID_TRANSITION", "Only confirmed bookings can be marked no-show.", 409);
      }
      order.status = "no_show";
      return order;
    });
  },

  async getWorkshopOrders(status?: string) {
    await wait();
    const user = actor("workshop_owner");
    const workshop = findWorkshopByOwner(user.id);
    return getDb().orders
      .filter((order) => order.workshopId === workshop.id)
      .filter((order) => (status ? order.status === status : true))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async markOrderPreparing(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.status !== "paid") {
        throw new ApiError("INVALID_TRANSITION", "Only paid orders can be prepared.", 409);
      }
      order.status = "preparing";
      order.preparingAt = new Date().toISOString();
      return order;
    });
  },

  async markOrderReady(id: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.status !== "preparing") {
        throw new ApiError("INVALID_TRANSITION", "Only preparing orders can be marked ready.", 409);
      }
      order.status = "ready_for_pickup";
      order.readyAt = new Date().toISOString();
      addNotification(
        db,
        order.customerId,
        "order_ready",
        order.fulfillment === "expedition" ? "Order ready to ship" : "Order ready for pickup",
        order.fulfillment === "expedition"
          ? `${order.workshopName} is packing ${order.code}. We will add the tracking number once it is handed to the courier.`
          : `${order.workshopName} marked ${order.code} ready. Show your pickup code at the counter.`,
        `/orders/${order.id}`,
      );
      return order;
    });
  },

  async shipOrder(id: string, trackingNumber: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.fulfillment !== "expedition" || !order.shipping) {
        throw new ApiError("INVALID_FULFILLMENT", "This order is for pickup, not delivery.", 409);
      }
      if (order.status !== "ready_for_pickup") {
        throw new ApiError("INVALID_TRANSITION", "Only packed orders can be shipped.", 409);
      }
      if (trackingNumber.trim().length < 4) {
        throw new ApiError("INVALID_TRACKING", "Enter a valid tracking number.", 400);
      }
      order.status = "shipped";
      order.shipping.trackingNumber = trackingNumber.trim();
      order.shipping.shippedAt = new Date().toISOString();
      addNotification(
        db,
        order.customerId,
        "order_shipped",
        "Order shipped",
        `${order.code} is on the way with ${courierName(order.shipping.courier)}. Tracking: ${trackingNumber.trim()}.`,
        `/orders/${order.id}`,
      );
      return order;
    });
  },

  async confirmDelivery(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order || order.customerId !== user.id) {
        throw new ApiError("NOT_FOUND", "Order not found.", 404);
      }
      if (order.status !== "shipped") {
        throw new ApiError("INVALID_TRANSITION", "This order has not been shipped yet.", 409);
      }
      order.status = "completed";
      order.completedAt = new Date().toISOString();
      const workshop = db.workshops.find((item) => item.id === order.workshopId);
      addNotification(
        db,
        workshop?.ownerUserId ?? order.customerId,
        "order_completed",
        "Delivery confirmed",
        `The customer confirmed delivery for ${order.code}.`,
        "/workshop/orders",
      );
      return order;
    });
  },

  async verifyPickup(id: string, pickupCode: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      const workshop = findWorkshopByOwner(user.id);
      if (order.workshopId !== workshop.id) throw new ApiError("NOT_FOUND", "Order not found.", 404);
      if (order.fulfillment === "expedition") {
        throw new ApiError("INVALID_FULFILLMENT", "This order is delivered by courier.", 409);
      }
      if (order.status !== "ready_for_pickup") {
        throw new ApiError("INVALID_TRANSITION", "This order is not ready for pickup.", 409);
      }
      if (order.pickupCode.toLowerCase() !== pickupCode.trim().toLowerCase()) {
        throw new ApiError("INVALID_PICKUP_CODE", "Pickup code does not match.", 400);
      }
      order.status = "completed";
      order.completedAt = new Date().toISOString();
      addNotification(
        db,
        order.customerId,
        "order_completed",
        "Pickup complete",
        `Your order at ${order.workshopName} is complete. Leave a review for the parts you bought.`,
        `/orders/${order.id}`,
      );
      return order;
    });
  },

  async listWorkshopReviews() {
    await wait();
    const user = actor("workshop_owner");
    const workshop = findWorkshopByOwner(user.id);
    return workshop.reviews.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async replyReview(id: string, body: string) {
    await wait();
    const user = actor("workshop_owner");
    return mutateDb((db) => {
      const workshop = db.workshops.find((item) => item.ownerUserId === user.id);
      const review = workshop?.reviews.find((item) => item.id === id);
      if (!review) throw new ApiError("NOT_FOUND", "Review not found.", 404);
      if (review.workshopReply) throw new ApiError("DUPLICATE_REPLY", "This review already has a reply.", 409);
      review.workshopReply = body;
      review.repliedAt = new Date().toISOString();
      addNotification(
        db,
        review.customerId,
        "review_reply",
        "Workshop replied to your review",
        `${workshop?.name} replied to your review.`,
        "/notifications",
      );
      return review;
    });
  },

  async getWorkshopDashboard(): Promise<WorkshopDashboard> {
    await wait();
    const user = actor("workshop_owner");
    const db = getDb();
    const workshop = findWorkshopByOwner(user.id);
    const reviews = workshop.reviews.filter((review) => review.status === "published");
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of reviews) distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    const todayKey = dateKeyInJakarta(new Date());
    const todayBookings = db.serviceOrders.filter(
      (order) =>
        order.workshopId === workshop.id &&
        dateKeyInJakarta(new Date(order.scheduledAt)) === todayKey &&
        ["requested", "confirmed", "in_progress"].includes(order.status),
    );
    const activeServiceOrders = db.serviceOrders.filter(
      (order) =>
        order.workshopId === workshop.id &&
        ["confirmed", "in_progress", "awaiting_approval"].includes(order.status),
    );
    const ordersNeedingAction = db.orders.filter(
      (order) =>
        order.workshopId === workshop.id &&
        ["paid", "preparing", "ready_for_pickup"].includes(order.status),
    );
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const inMonth = (value?: string) => {
      if (!value) return false;
      const date = new Date(value);
      return date.getMonth() === month && date.getFullYear() === year;
    };
    const revenueThisMonth =
      db.serviceOrders
        .filter((order) => order.workshopId === workshop.id && order.status === "paid" && inMonth(order.paidAt))
        .reduce((sum, order) => sum + (order.finalTotal ?? order.estimatedTotal), 0) +
      db.orders
        .filter(
          (order) =>
            order.workshopId === workshop.id &&
            inMonth(order.paidAt) &&
            !["cancelled", "expired", "pending_payment"].includes(order.status),
        )
        .reduce((sum, order) => sum + order.total, 0);
    const profileChecklist = [
      { key: "name", label: "Workshop name", done: Boolean(workshop.name) },
      { key: "type", label: "Workshop type", done: Boolean(workshop.workshopType) },
      { key: "phone", label: "Phone number", done: Boolean(workshop.phone) },
      { key: "address", label: "Address and coordinates", done: Boolean(workshop.addressLine && workshop.lat && workshop.lng) },
      { key: "hours", label: "Opening hours", done: workshop.hours.some((hour) => !hour.isClosed) },
      { key: "cover", label: "Cover image", done: Boolean(workshop.coverUrl) },
      { key: "email", label: "Verified email", done: user.emailVerified },
    ];
    return {
      workshop: publicWorkshop(workshop),
      ratingAvg: workshop.ratingAvg,
      ratingCount: workshop.ratingCount,
      distribution,
      recentReviews: reviews.slice(0, 5),
      todayBookings,
      activeServiceOrders,
      ordersNeedingAction,
      revenueThisMonth,
      profileChecklist,
    };
  },

  async listConversations(scope: "customer" | "workshop" = "customer") {
    await wait();
    const user = actor();
    const db = getDb();
    let conversations = db.conversations;
    if (scope === "workshop") {
      const workshop = findWorkshopByOwner(user.id);
      conversations = conversations.filter((conversation) => conversation.workshopId === workshop.id);
    } else {
      conversations = conversations.filter((conversation) => conversation.customerId === user.id);
    }
    return conversations
      .map((conversation) => {
        const messages = db.messages
          .filter((message) => message.conversationId === conversation.id && !message.deletedAt)
          .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        const last = messages.at(-1);
        const unreadCount = messages.filter(
          (message) => message.senderUserId !== user.id && !message.readAt,
        ).length;
        return {
          ...conversation,
          lastMessage: last?.body,
          lastMessageAt: last?.createdAt ?? conversation.lastMessageAt,
          unreadCount,
        };
      })
      .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  },

  async getConversation(id: string) {
    await wait();
    const user = actor();
    const db = getDb();
    const conversation = db.conversations.find((item) => item.id === id);
    if (!conversation) throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
    ensureConversationAccess(conversation, user);
    const messages = db.messages
      .filter((message) => message.conversationId === id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return { conversation, messages };
  },

  async startConversation(workshopId: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const existing = db.conversations.find(
        (conversation) =>
          conversation.customerId === user.id && conversation.workshopId === workshopId,
      );
      if (existing) return existing;
      const workshop = db.workshops.find((item) => item.id === workshopId);
      if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
      const conversation = {
        id: uid("conv"),
        customerId: user.id,
        customerName: user.fullName,
        workshopId: workshop.id,
        workshopName: workshop.name,
        workshopSlug: workshop.slug,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };
      db.conversations.push(conversation);
      return conversation;
    });
  },

  async sendMessage(conversationId: string, body: string, attachmentUrl?: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const conversation = db.conversations.find((item) => item.id === conversationId);
      if (!conversation) throw new ApiError("NOT_FOUND", "Conversation not found.", 404);
      ensureConversationAccess(conversation, user);
      if (!body.trim() && !attachmentUrl) {
        throw new ApiError("VALIDATION_ERROR", "Write a message first.", 422);
      }
      if (body.length > 2000) {
        throw new ApiError("VALIDATION_ERROR", "Messages are limited to 2,000 characters.", 422);
      }
      const message: Message = {
        id: uid("msg"),
        conversationId,
        senderUserId: user.id,
        senderName: user.fullName,
        senderRole: user.role,
        body: body.trim(),
        attachmentUrl,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(message);
      conversation.lastMessageAt = message.createdAt;
      const recipientId =
        user.role === "customer"
          ? db.workshops.find((item) => item.id === conversation.workshopId)?.ownerUserId
          : conversation.customerId;
      if (recipientId) {
        addNotification(
          db,
          recipientId,
          "chat_message",
          "New chat message",
          `${user.fullName}: ${body.slice(0, 80)}`,
          user.role === "customer" ? `/workshop/chat?thread=${conversationId}` : `/chat/${conversationId}`,
        );
      }
      return message;
    });
  },

  async markConversationRead(conversationId: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      db.messages
        .filter((message) => message.conversationId === conversationId && message.senderUserId !== user.id && !message.readAt)
        .forEach((message) => {
          message.readAt = new Date().toISOString();
        });
      return { ok: true };
    });
  },

  async listNotifications() {
    await wait();
    const user = actor();
    return getDb().notifications
      .filter((notification) => notification.userId === user.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async markNotificationRead(id: string) {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      const notification = db.notifications.find(
        (item) => item.id === id && item.userId === user.id,
      );
      if (notification) notification.readAt = new Date().toISOString();
      return notification ?? null;
    });
  },

  async markAllNotificationsRead() {
    await wait();
    const user = actor();
    return mutateDb((db) => {
      db.notifications
        .filter((notification) => notification.userId === user.id && !notification.readAt)
        .forEach((notification) => {
          notification.readAt = new Date().toISOString();
        });
      return { ok: true };
    });
  },

  async resetDemo() {
    await wait();
    return resetDb();
  },
};

function hydrateCart(cart: Cart, db: ReturnType<typeof getDb>): Cart {
  return {
    ...cart,
    items: cart.items.map((item) => {
      const product = db.workshops
        .flatMap((workshop) => workshop.products)
        .find((entry) => entry.id === item.productId);
      const hydratedProduct = product ?? item.product;
      return {
        ...item,
        product: hydratedProduct,
        subtotal: item.qty * hydratedProduct.finalPrice,
      };
    }),
    subtotal: cart.items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}
