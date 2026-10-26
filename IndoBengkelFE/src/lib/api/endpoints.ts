/**
 * REST paths for the NestJS API described in docs/TSD.md.
 * The UI never hard-codes a URL: everything goes through `api` in client.ts.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    registerCustomer: "/auth/register/customer",
    registerWorkshop: "/auth/register/workshop",
    me: "/auth/me",
    verifyEmail: "/auth/verify-email",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
  },
  workshops: {
    list: "/workshops",
    detail: (slug: string) => `/workshops/${slug}`,
    availability: (id: string) => `/workshops/${id}/availability`,
  },
  products: {
    list: "/products",
    detail: (slug: string) => `/products/${slug}`,
  },
  cart: {
    detail: "/cart",
    items: "/cart/items",
    item: (id: string) => `/cart/items/${id}`,
  },
  orders: {
    list: "/orders",
    detail: (id: string) => `/orders/${id}`,
    cancel: (id: string) => `/orders/${id}/cancel`,
    pay: (id: string) => `/orders/${id}/pay`,
    confirmDelivery: (id: string) => `/orders/${id}/confirm-delivery`,
  },
  vehicles: {
    list: "/vehicles",
    detail: (id: string) => `/vehicles/${id}`,
  },
  serviceOrders: {
    list: "/service-orders",
    detail: (id: string) => `/service-orders/${id}`,
    cancel: (id: string) => `/service-orders/${id}/cancel`,
    approveEstimate: (id: string) => `/service-orders/${id}/approve-estimate`,
    rejectEstimate: (id: string) => `/service-orders/${id}/reject-estimate`,
    pay: (id: string) => `/service-orders/${id}/pay`,
    simulatePaid: (id: string) => `/service-orders/${id}/simulate-paid`,
  },
  reviews: {
    workshop: "/reviews/workshop",
    product: "/reviews/product",
  },
  workshop: {
    me: "/workshop/me",
    dashboard: "/workshop/dashboard",
    mechanics: "/workshop/mechanics",
    mechanic: (id: string) => `/workshop/mechanics/${id}`,
    services: "/workshop/services",
    service: (id: string) => `/workshop/services/${id}`,
    products: "/workshop/products",
    product: (id: string) => `/workshop/products/${id}`,
    bookings: "/workshop/bookings",
    booking: (id: string) => `/workshop/bookings/${id}`,
    serviceOrder: (id: string) => `/workshop/service-orders/${id}`,
    orders: "/workshop/orders",
    order: (id: string) => `/workshop/orders/${id}`,
    shipOrder: (id: string) => `/workshop/orders/${id}/ship`,
    reviews: "/workshop/reviews",
    review: (id: string) => `/workshop/reviews/${id}`,
  },
  conversations: {
    list: "/conversations",
    detail: (id: string) => `/conversations/${id}`,
    messages: (id: string) => `/conversations/${id}/messages`,
    read: (id: string) => `/conversations/${id}/read`,
  },
  notifications: {
    list: "/notifications",
    read: (id: string) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
  },
  demo: {
    reset: "/demo/reset",
  },
} as const;
