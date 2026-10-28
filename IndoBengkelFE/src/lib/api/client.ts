import type {
  CreateBookingInput,
  CreateOrderInput,
  CreateReviewInput,
  LoginInput,
  Mechanic,
  PaymentMethod,
  Product,
  ProductQuery,
  RegisterCustomerInput,
  RegisterWorkshopInput,
  Service,
  ServiceOrderItem,
  Vehicle,
  Workshop,
  WorkshopQuery,
} from "./types";
import type { ApiClient } from "./api-client";
import { endpoints } from "./endpoints";
import { apiFetch, buildQuery } from "./http";

function createRestApi(): ApiClient {
  const restApi: ApiClient = {
    login: (input: LoginInput) =>
      apiFetch(endpoints.auth.login, { method: "POST", body: JSON.stringify(input) }),
    registerCustomer: (input: RegisterCustomerInput) =>
      apiFetch(endpoints.auth.registerCustomer, { method: "POST", body: JSON.stringify(input) }),
    registerWorkshop: (input: RegisterWorkshopInput) =>
      apiFetch(endpoints.auth.registerWorkshop, { method: "POST", body: JSON.stringify(input) }),
    me: () => apiFetch(endpoints.auth.me),
    verifyEmail: () => apiFetch(endpoints.auth.verifyEmail, { method: "POST" }),
    updateLocale: (locale: "en" | "id") =>
      apiFetch("/me/locale", { method: "PATCH", body: JSON.stringify({ locale }) }),

    // `useWorkshops` consumes `{ data, meta }`; keep the envelope for paginated lists.
    listWorkshops: (query: WorkshopQuery = {}) =>
      apiFetch(
        `${endpoints.workshops.list}${buildQuery(query as unknown as Record<string, unknown>)}`,
        {},
        { preserveEnvelope: true },
      ),
    getWorkshop: (slug: string, lat?: number, lng?: number) =>
      apiFetch(`${endpoints.workshops.detail(slug)}${buildQuery({ lat, lng })}`),
    getAvailability: (workshopId: string, date: string) =>
      apiFetch(`${endpoints.workshops.availability(workshopId)}${buildQuery({ date })}`),

    listProducts: (query: ProductQuery = {}) =>
      apiFetch(
        `${endpoints.products.list}${buildQuery(query as unknown as Record<string, unknown>)}`,
        {},
        { preserveEnvelope: true },
      ),
    getProduct: (slug: string) => apiFetch(endpoints.products.detail(slug)),

    listCarts: () => apiFetch(endpoints.cart.detail),
    addToCart: (workshopId: string, productId: string, qty = 1) =>
      apiFetch(endpoints.cart.items, {
        method: "POST",
        body: JSON.stringify({ workshopId, productId, qty }),
      }),
    updateCartItem: (itemId: string, qty: number) =>
      apiFetch(endpoints.cart.item(itemId), { method: "PATCH", body: JSON.stringify({ qty }) }),
    removeCartItem: (itemId: string) =>
      apiFetch(endpoints.cart.item(itemId), { method: "DELETE" }),
    clearCart: (workshopId: string) =>
      apiFetch(`${endpoints.cart.detail}${buildQuery({ workshopId })}`, { method: "DELETE" }),

    createOrder: (input: CreateOrderInput) =>
      apiFetch(endpoints.orders.list, { method: "POST", body: JSON.stringify(input) }),
    listOrders: () => apiFetch(endpoints.orders.list),
    getOrder: (id: string) => apiFetch(endpoints.orders.detail(id)),
    cancelOrder: (id: string) =>
      apiFetch(endpoints.orders.cancel(id), { method: "POST" }),
    simulateOrderPayment: (id: string) =>
      apiFetch(endpoints.orders.pay(id), { method: "POST" }),
    confirmDelivery: (id: string) =>
      apiFetch(endpoints.orders.confirmDelivery(id), { method: "POST" }),
    reviewProduct: (input: CreateReviewInput) =>
      apiFetch(endpoints.reviews.product, { method: "POST", body: JSON.stringify(input) }),

    listVehicles: () => apiFetch(endpoints.vehicles.list),
    getVehicle: (id: string) => apiFetch(endpoints.vehicles.detail(id)),
    createVehicle: (input: Omit<Vehicle, "id" | "customerId">) =>
      apiFetch(endpoints.vehicles.list, { method: "POST", body: JSON.stringify(input) }),
    updateVehicle: (id: string, input: Partial<Vehicle>) =>
      apiFetch(endpoints.vehicles.detail(id), { method: "PATCH", body: JSON.stringify(input) }),
    deleteVehicle: (id: string) =>
      apiFetch(endpoints.vehicles.detail(id), { method: "DELETE" }),

    listServiceOrders: () => apiFetch(endpoints.serviceOrders.list),
    getServiceOrder: (id: string) => apiFetch(endpoints.serviceOrders.detail(id)),
    createBooking: (input: CreateBookingInput) =>
      apiFetch(endpoints.serviceOrders.list, { method: "POST", body: JSON.stringify(input) }),
    cancelBooking: (id: string) =>
      apiFetch(endpoints.serviceOrders.cancel(id), { method: "POST" }),
    approveEstimate: (id: string) =>
      apiFetch(endpoints.serviceOrders.approveEstimate(id), { method: "POST" }),
    rejectEstimate: (id: string) =>
      apiFetch(endpoints.serviceOrders.rejectEstimate(id), { method: "POST" }),
    payServiceOrder: (id: string, method: PaymentMethod) =>
      apiFetch(endpoints.serviceOrders.pay(id), {
        method: "POST",
        body: JSON.stringify({ method }),
      }),
    simulateServicePayment: (id: string) =>
      apiFetch(endpoints.serviceOrders.simulatePaid(id), { method: "POST" }),
    reviewWorkshop: (input: CreateReviewInput) =>
      apiFetch(endpoints.reviews.workshop, { method: "POST", body: JSON.stringify(input) }),

    getWorkshopMe: () => apiFetch(endpoints.workshop.me),
    updateWorkshop: (input: Partial<Workshop>) =>
      apiFetch(endpoints.workshop.me, { method: "PATCH", body: JSON.stringify(input) }),
    listMechanics: () => apiFetch(endpoints.workshop.mechanics),
    createMechanic: (input: Omit<Mechanic, "id" | "workshopId">) =>
      apiFetch(endpoints.workshop.mechanics, { method: "POST", body: JSON.stringify(input) }),
    updateMechanic: (id: string, input: Partial<Mechanic>) =>
      apiFetch(endpoints.workshop.mechanic(id), { method: "PATCH", body: JSON.stringify(input) }),
    deleteMechanic: (id: string) =>
      apiFetch(endpoints.workshop.mechanic(id), { method: "DELETE" }),
    listWorkshopServices: () => apiFetch(endpoints.workshop.services),
    createWorkshopService: (input: Omit<Service, "id" | "workshopId">) =>
      apiFetch(endpoints.workshop.services, { method: "POST", body: JSON.stringify(input) }),
    updateWorkshopService: (id: string, input: Partial<Service>) =>
      apiFetch(endpoints.workshop.service(id), { method: "PATCH", body: JSON.stringify(input) }),
    deleteWorkshopService: (id: string) =>
      apiFetch(endpoints.workshop.service(id), { method: "DELETE" }),
    listWorkshopProducts: () => apiFetch(endpoints.workshop.products),
    createWorkshopProduct: (input: Partial<Product>) =>
      apiFetch(endpoints.workshop.products, { method: "POST", body: JSON.stringify(input) }),
    updateWorkshopProduct: (id: string, input: Partial<Product>) =>
      apiFetch(endpoints.workshop.product(id), { method: "PATCH", body: JSON.stringify(input) }),
    deleteWorkshopProduct: (id: string) =>
      apiFetch(endpoints.workshop.product(id), { method: "DELETE" }),
    getWorkshopBookings: (status?: string) =>
      apiFetch(`${endpoints.workshop.bookings}${buildQuery({ status })}`),
    confirmBooking: (id: string, estimatedTotal: number) =>
      apiFetch(`${endpoints.workshop.booking(id)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ estimatedTotal }),
      }),
    declineBooking: (id: string, reason: string) =>
      apiFetch(`${endpoints.workshop.booking(id)}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    startService: (id: string, odometerIn: number, mechanicIds: string[]) =>
      apiFetch(`${endpoints.workshop.serviceOrder(id)}/start`, {
        method: "POST",
        body: JSON.stringify({ odometerIn, mechanicIds }),
      }),
    completeService: (
      id: string,
      input: { items: ServiceOrderItem[]; photos: string[]; mechanicNote: string; finalTotal: number },
    ) =>
      apiFetch(`${endpoints.workshop.serviceOrder(id)}/complete`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    markCashPaid: (id: string) =>
      apiFetch(`${endpoints.workshop.serviceOrder(id)}/cash-paid`, { method: "POST" }),
    markNoShow: (id: string) =>
      apiFetch(`${endpoints.workshop.booking(id)}/no-show`, { method: "POST" }),
    getWorkshopOrders: (status?: string) =>
      apiFetch(`${endpoints.workshop.orders}${buildQuery({ status })}`),
    markOrderPreparing: (id: string) =>
      apiFetch(`${endpoints.workshop.order(id)}/preparing`, { method: "POST" }),
    markOrderReady: (id: string) =>
      apiFetch(`${endpoints.workshop.order(id)}/ready`, { method: "POST" }),
    verifyPickup: (id: string, pickupCode: string) =>
      apiFetch(`${endpoints.workshop.order(id)}/verify-pickup`, {
        method: "POST",
        body: JSON.stringify({ pickupCode }),
      }),
    shipOrder: (id: string, trackingNumber: string) =>
      apiFetch(endpoints.workshop.shipOrder(id), {
        method: "POST",
        body: JSON.stringify({ trackingNumber }),
      }),
    listWorkshopReviews: () => apiFetch(endpoints.workshop.reviews),
    replyReview: (id: string, body: string) =>
      apiFetch(`${endpoints.workshop.review(id)}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    getWorkshopDashboard: () => apiFetch(endpoints.workshop.dashboard),

    listConversations: (scope: "customer" | "workshop" = "customer") =>
      apiFetch(`${endpoints.conversations.list}${buildQuery({ scope })}`),
    getConversation: (id: string) => apiFetch(endpoints.conversations.detail(id)),
    startConversation: (workshopId: string) =>
      apiFetch(endpoints.conversations.list, {
        method: "POST",
        body: JSON.stringify({ workshopId }),
      }),
    sendMessage: (conversationId: string, body: string, attachmentUrl?: string) =>
      apiFetch(endpoints.conversations.messages(conversationId), {
        method: "POST",
        body: JSON.stringify({ body, attachmentUrl }),
      }),
    markConversationRead: (conversationId: string) =>
      apiFetch(endpoints.conversations.read(conversationId), { method: "POST" }),

    listNotifications: () => apiFetch(endpoints.notifications.list),
    markNotificationRead: (id: string) =>
      apiFetch(endpoints.notifications.read(id), { method: "POST" }),
    markAllNotificationsRead: () =>
      apiFetch(endpoints.notifications.readAll, { method: "POST" }),
  };

  return restApi;
}

export const api = createRestApi();
