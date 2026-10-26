export type Locale = "en" | "id";

export type UserRole = "customer" | "workshop_owner";

export type WorkshopType = "motor" | "mobil";

export type WorkshopStatus = "draft" | "active" | "suspended";

export type ServiceOrderStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "no_show"
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "paid";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready_for_pickup"
  | "shipped"
  | "completed"
  | "cancelled"
  | "expired";

export type FulfillmentMethod = "pickup" | "expedition";

export interface ShippingAddress {
  recipient: string;
  phone: string;
  line: string;
  city: string;
  postalCode: string;
}

export interface OrderShipping {
  courier: string;
  service: string;
  cost: number;
  address: ShippingAddress;
  trackingNumber?: string;
  shippedAt?: string;
}

export type PaymentMethod = "va" | "bank_transfer" | "qris" | "cash";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export type ProductCategory =
  | "sparepart"
  | "oil"
  | "accessories"
  | "tools"
  | "other";

export type ReviewTag =
  | "fair_price"
  | "fast"
  | "honest"
  | "clean"
  | "friendly";

export type NotificationType =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "service_started"
  | "estimate_approval"
  | "service_completed"
  | "service_paid"
  | "order_paid"
  | "order_ready"
  | "order_shipped"
  | "order_completed"
  | "chat_message"
  | "review_reply"
  | "service_reminder"
  | "workshop_suspended";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  locale: Locale;
  avatarUrl?: string;
  emailVerified: boolean;
  status: "active" | "suspended";
  createdAt: string;
}

export interface Session {
  user: User;
  accessTokenExpiresAt: string;
  csrfToken: string;
}

export interface WorkshopHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface Mechanic {
  id: string;
  workshopId: string;
  name: string;
  phone: string;
  experienceYears: number;
  skills: string[];
  photoUrl?: string;
  isActive: boolean;
}

export type ServiceCategory =
  | "inspection"
  | "oil"
  | "engine"
  | "brakes"
  | "electrical"
  | "tires"
  | "body"
  | "other";

export type ServiceKind = "labor" | "part";

export interface Service {
  id: string;
  workshopId: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: ServiceCategory;
  kind: ServiceKind;
  isActive: boolean;
}

export interface Product {
  id: string;
  workshopId: string;
  workshopSlug: string;
  workshopName: string;
  workshopType: WorkshopType;
  title: string;
  slug: string;
  description: string;
  category: ProductCategory;
  brand: string;
  partNumber: string;
  price: number;
  finalPrice: number;
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  weightGrams: number;
  stock: number;
  isActive: boolean;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string;
  distanceKm?: number;
}

export interface Review {
  id: string;
  customerId: string;
  customerName: string;
  workshopId: string;
  serviceOrderId?: string;
  orderId?: string;
  productId?: string;
  rating: number;
  comment: string;
  tags: ReviewTag[];
  status: "published" | "hidden";
  workshopReply?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface Workshop {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string;
  workshopType: WorkshopType;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  coverUrl: string;
  logoUrl?: string;
  gallery: string[];
  status: WorkshopStatus;
  ratingAvg: number;
  ratingCount: number;
  distanceKm?: number;
  openNow?: boolean;
  nextSlot?: string;
  hours: WorkshopHours[];
  closures: { id: string; date: string; reason?: string }[];
  slotCapacityPerHour: number;
  services: Service[];
  mechanics: Mechanic[];
  products: Product[];
  reviews: Review[];
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  type: WorkshopType;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  color: string;
  odometerKm: number;
  photoUrl?: string;
  reminderMonths: number;
  reminderKm: number;
  lastServiceAt?: string;
  lastWorkshopName?: string;
}

export interface ServiceOrderItem {
  id: string;
  kind: "labor" | "part";
  productId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface ServiceOrder {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  workshopType: WorkshopType;
  vehicleId: string;
  vehicleLabel: string;
  plateNumber: string;
  status: ServiceOrderStatus;
  scheduledAt: string;
  complaint: string;
  customerNote?: string;
  odometerIn: number;
  odometerOut?: number;
  estimatedTotal: number;
  finalTotal?: number;
  mechanicNote?: string;
  mechanicIds: string[];
  mechanicNames: string[];
  items: ServiceOrderItem[];
  photos: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  cancelReason?: string;
  reviewId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  qty: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  customerId: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  items: CartItem[];
  subtotal: number;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId?: string;
  serviceOrderId?: string;
  provider: "fake" | "midtrans";
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  providerRef: string;
  vaNumber?: string;
  qrString?: string;
  expiresAt: string;
  paidAt?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  titleSnapshot: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
  weightGrams: number;
  imageUrl: string;
  reviewed?: boolean;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  status: OrderStatus;
  fulfillment: FulfillmentMethod;
  shippingCost: number;
  shipping?: OrderShipping;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  pickupCode: string;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  payment: Payment;
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  lastMessageAt: string;
  lastMessage?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderRole: UserRole;
  body: string;
  attachmentUrl?: string;
  readAt?: string;
  deletedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface WorkshopDashboard {
  workshop: Workshop;
  ratingAvg: number;
  ratingCount: number;
  distribution: RatingDistribution;
  recentReviews: Review[];
  todayBookings: ServiceOrder[];
  activeServiceOrders: ServiceOrder[];
  ordersNeedingAction: Order[];
  revenueThisMonth: number;
  profileChecklist: { key: string; label: string; done: boolean }[];
}

export interface ApiMeta {
  page: number;
  perPage: number;
  total: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface WorkshopQuery {
  lat?: number;
  lng?: number;
  radius?: number;
  type?: WorkshopType | "all";
  openNow?: boolean;
  minRating?: number;
  q?: string;
  sort?: "nearest" | "rating" | "name";
  page?: number;
  perPage?: number;
}

export interface ProductQuery {
  q?: string;
  workshopType?: WorkshopType | "all";
  category?: ProductCategory | "all";
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  workshopId?: string;
  page?: number;
  perPage?: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterCustomerInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterWorkshopInput {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  workshopName: string;
  workshopType: WorkshopType;
  addressLine: string;
  city: string;
  lat: number;
  lng: number;
}

export interface CreateBookingInput {
  workshopId: string;
  vehicleId: string;
  serviceIds: string[];
  scheduledAt: string;
  complaint: string;
  odometer: number;
  customerNote?: string;
}

export interface CreateOrderInput {
  workshopId: string;
  customerPhone: string;
  paymentMethod: Exclude<PaymentMethod, "cash">;
  fulfillment: FulfillmentMethod;
  shipping?: {
    courier: string;
    address: ShippingAddress;
  };
}

export interface CreateReviewInput {
  target: "workshop" | "product";
  serviceOrderId?: string;
  orderId?: string;
  productId?: string;
  rating: number;
  comment: string;
  tags?: ReviewTag[];
}
