import type {
  Cart,
  Conversation,
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
} from "./types";

export type ApiClient = {
  login(input: LoginInput): Promise<User>;
  registerCustomer(input: RegisterCustomerInput): Promise<User>;
  registerWorkshop(input: RegisterWorkshopInput): Promise<User>;
  me(): Promise<User>;
  verifyEmail(): Promise<User>;
  updateLocale(locale: "en" | "id"): Promise<User>;
  listWorkshops(query?: WorkshopQuery): Promise<{
    data: Workshop[];
    meta: { page: number; perPage: number; total: number };
  }>;
  getWorkshop(slug: string, lat?: number, lng?: number): Promise<Workshop>;
  getAvailability(
    workshopId: string,
    date: string,
  ): Promise<{ time: string; iso: string; available: boolean; remaining: number }[]>;
  listProducts(query?: ProductQuery): Promise<{
    data: Product[];
    meta: { page: number; perPage: number; total: number };
  }>;
  getProduct(slug: string): Promise<Product>;
  listCarts(): Promise<Cart[]>;
  addToCart(workshopId: string, productId: string, qty?: number): Promise<Cart>;
  updateCartItem(itemId: string, qty: number): Promise<Cart>;
  removeCartItem(itemId: string): Promise<Cart | null>;
  clearCart(workshopId: string): Promise<null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order>;
  cancelOrder(id: string): Promise<Order>;
  simulateOrderPayment(id: string): Promise<Order>;
  confirmDelivery(id: string): Promise<Order>;
  reviewProduct(input: CreateReviewInput): Promise<Review>;
  listVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle>;
  createVehicle(input: Omit<Vehicle, "id" | "customerId">): Promise<Vehicle>;
  updateVehicle(id: string, input: Partial<Vehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<{ ok: boolean }>;
  listServiceOrders(): Promise<ServiceOrder[]>;
  getServiceOrder(id: string): Promise<ServiceOrder>;
  createBooking(input: CreateBookingInput): Promise<ServiceOrder>;
  cancelBooking(id: string): Promise<ServiceOrder>;
  approveEstimate(id: string): Promise<ServiceOrder>;
  rejectEstimate(id: string): Promise<ServiceOrder>;
  payServiceOrder(id: string, method: PaymentMethod): Promise<ServiceOrder>;
  simulateServicePayment(id: string): Promise<ServiceOrder>;
  reviewWorkshop(input: CreateReviewInput): Promise<Review>;
  getWorkshopMe(): Promise<Workshop>;
  updateWorkshop(input: Partial<Workshop>): Promise<Workshop>;
  listMechanics(): Promise<Mechanic[]>;
  createMechanic(input: Omit<Mechanic, "id" | "workshopId">): Promise<Mechanic>;
  updateMechanic(id: string, input: Partial<Mechanic>): Promise<Mechanic>;
  deleteMechanic(id: string): Promise<{ ok: boolean }>;
  listWorkshopServices(): Promise<Service[]>;
  createWorkshopService(input: Omit<Service, "id" | "workshopId">): Promise<Service>;
  updateWorkshopService(id: string, input: Partial<Service>): Promise<Service>;
  deleteWorkshopService(id: string): Promise<{ ok: boolean }>;
  listWorkshopProducts(): Promise<Product[]>;
  createWorkshopProduct(input: Partial<Product>): Promise<Product>;
  updateWorkshopProduct(id: string, input: Partial<Product>): Promise<Product>;
  deleteWorkshopProduct(id: string): Promise<{ ok: boolean }>;
  getWorkshopBookings(status?: string): Promise<ServiceOrder[]>;
  confirmBooking(id: string, estimatedTotal: number): Promise<ServiceOrder>;
  declineBooking(id: string, reason: string): Promise<ServiceOrder>;
  startService(id: string, odometerIn: number, mechanicIds: string[]): Promise<ServiceOrder>;
  completeService(
    id: string,
    input: { items: ServiceOrderItem[]; photos: string[]; mechanicNote: string; finalTotal: number },
  ): Promise<ServiceOrder>;
  markCashPaid(id: string): Promise<ServiceOrder>;
  markNoShow(id: string): Promise<ServiceOrder>;
  getWorkshopOrders(status?: string): Promise<Order[]>;
  markOrderPreparing(id: string): Promise<Order>;
  markOrderReady(id: string): Promise<Order>;
  verifyPickup(id: string, pickupCode: string): Promise<Order>;
  shipOrder(id: string, trackingNumber: string): Promise<Order>;
  listWorkshopReviews(): Promise<Review[]>;
  replyReview(id: string, body: string): Promise<Review>;
  getWorkshopDashboard(): Promise<WorkshopDashboard>;
  listConversations(scope?: "customer" | "workshop"): Promise<
    {
      lastMessage: string | undefined;
      lastMessageAt: string;
      unreadCount: number;
      id: string;
      customerId: string;
      customerName: string;
      workshopId: string;
      workshopName: string;
      workshopSlug: string;
    }[]
  >;
  getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }>;
  startConversation(workshopId: string): Promise<{
    id: string;
    customerId: string;
    customerName: string;
    workshopId: string;
    workshopName: string;
    workshopSlug: string;
    lastMessageAt: string;
    unreadCount: number;
  }>;
  sendMessage(conversationId: string, body: string, attachmentUrl?: string): Promise<Message>;
  markConversationRead(conversationId: string): Promise<{ ok: boolean }>;
  listNotifications(): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | null>;
  markAllNotificationsRead(): Promise<{ ok: boolean }>;
};
