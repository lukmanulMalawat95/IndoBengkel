"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./query-keys";
import type {
  CreateBookingInput,
  CreateOrderInput,
  CreateReviewInput,
  Mechanic,
  PaymentMethod,
  Product,
  ProductQuery,
  Service,
  ServiceOrderItem,
  Vehicle,
  Workshop,
  WorkshopQuery,
} from "./types";

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useWorkshops(query: WorkshopQuery = {}) {
  return useQuery({
    queryKey: queryKeys.workshops(query),
    queryFn: () => api.listWorkshops(query),
  });
}

export function useWorkshop(slug: string, lat?: number, lng?: number) {
  return useQuery({
    queryKey: queryKeys.workshop(slug, lat, lng),
    queryFn: () => api.getWorkshop(slug, lat, lng),
    enabled: Boolean(slug),
  });
}

export function useAvailability(workshopId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.availability(workshopId, date),
    queryFn: () => api.getAvailability(workshopId, date),
    enabled: enabled && Boolean(workshopId && date),
  });
}

export function useProducts(query: ProductQuery = {}) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => api.listProducts(query),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => api.getProduct(slug),
    enabled: Boolean(slug),
  });
}

export function useCarts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.cart(),
    queryFn: () => api.listCarts(),
    enabled,
  });
}

export function useAddToCart() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: {
      workshopId: string;
      productId: string;
      qty?: number;
    }) => api.addToCart(input.workshopId, input.productId, input.qty),
    onSuccess: invalidate,
  });
}

export function useUpdateCartItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { itemId: string; qty: number }) =>
      api.updateCartItem(input.itemId, input.qty),
    onSuccess: invalidate,
  });
}

export function useRemoveCartItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (itemId: string) => api.removeCartItem(itemId),
    onSuccess: invalidate,
  });
}

export function useClearCart() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (workshopId: string) => api.clearCart(workshopId),
    onSuccess: invalidate,
  });
}

export function useCreateOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
    onSuccess: invalidate,
  });
}

export function useOrders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders(),
    queryFn: () => api.listOrders(),
    enabled,
  });
}

export function useOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.getOrder(id),
    enabled: enabled && Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "pending_payment" ? 5_000 : false,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.cancelOrder(id),
    onSuccess: invalidate,
  });
}

export function useSimulateOrderPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.simulateOrderPayment(id),
    onSuccess: invalidate,
  });
}

export function useReviewProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => api.reviewProduct(input),
    onSuccess: invalidate,
  });
}

export function useVehicles(enabled = true) {
  return useQuery({
    queryKey: queryKeys.vehicles(),
    queryFn: () => api.listVehicles(),
    enabled,
  });
}

export function useVehicle(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.vehicle(id),
    queryFn: () => api.getVehicle(id),
    enabled: enabled && Boolean(id),
  });
}

export function useCreateVehicle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Omit<Vehicle, "id" | "customerId">) => api.createVehicle(input),
    onSuccess: invalidate,
  });
}

export function useUpdateVehicle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<Vehicle> }) =>
      api.updateVehicle(input.id, input.values),
    onSuccess: invalidate,
  });
}

export function useDeleteVehicle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: invalidate,
  });
}

export function useServiceOrders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.serviceOrders(),
    queryFn: () => api.listServiceOrders(),
    enabled,
  });
}

export function useServiceOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.serviceOrder(id),
    queryFn: () => api.getServiceOrder(id),
    enabled: enabled && Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "completed" &&
      query.state.data?.payment?.status === "pending"
        ? 5_000
        : false,
  });
}

export function useCreateBooking() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.createBooking(input),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.cancelBooking(id),
    onSuccess: invalidate,
  });
}

export function useApproveEstimate() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.approveEstimate(id),
    onSuccess: invalidate,
  });
}

export function useRejectEstimate() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.rejectEstimate(id),
    onSuccess: invalidate,
  });
}

export function usePayServiceOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; method: PaymentMethod }) =>
      api.payServiceOrder(input.id, input.method),
    onSuccess: invalidate,
  });
}

export function useSimulateServicePayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.simulateServicePayment(id),
    onSuccess: invalidate,
  });
}

export function useReviewWorkshop() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => api.reviewWorkshop(input),
    onSuccess: invalidate,
  });
}

export function useConversations(
  enabled = true,
  scope: "customer" | "workshop" = "customer",
) {
  return useQuery({
    queryKey: [...queryKeys.conversations(), scope],
    queryFn: () => api.listConversations(scope),
    enabled,
    refetchInterval: 8_000,
  });
}

export function useConversation(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => api.getConversation(id),
    enabled: enabled && Boolean(id),
    refetchInterval: 5_000,
  });
}

export function useStartConversation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (workshopId: string) => api.startConversation(workshopId),
    onSuccess: invalidate,
  });
}

export function useSendMessage() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { conversationId: string; body: string; attachmentUrl?: string }) =>
      api.sendMessage(input.conversationId, input.body, input.attachmentUrl),
    onSuccess: invalidate,
  });
}

export function useMarkConversationRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (conversationId: string) => api.markConversationRead(conversationId),
    onSuccess: invalidate,
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.listNotifications(),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: invalidate,
  });
}

export function useWorkshopMe() {
  return useQuery({
    queryKey: queryKeys.workshopMe(),
    queryFn: () => api.getWorkshopMe(),
  });
}

export function useUpdateWorkshop() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<Workshop>) => api.updateWorkshop(input),
    onSuccess: invalidate,
  });
}

export function useMechanics() {
  return useQuery({
    queryKey: queryKeys.mechanics(),
    queryFn: () => api.listMechanics(),
  });
}

export function useCreateMechanic() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Omit<Mechanic, "id" | "workshopId">) => api.createMechanic(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMechanic() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<Mechanic> }) =>
      api.updateMechanic(input.id, input.values),
    onSuccess: invalidate,
  });
}

export function useDeleteMechanic() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteMechanic(id),
    onSuccess: invalidate,
  });
}

export function useWorkshopServices() {
  return useQuery({
    queryKey: queryKeys.workshopServices(),
    queryFn: () => api.listWorkshopServices(),
  });
}

export function useCreateWorkshopService() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Omit<Service, "id" | "workshopId">) =>
      api.createWorkshopService(input),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkshopService() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<Service> }) =>
      api.updateWorkshopService(input.id, input.values),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkshopService() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkshopService(id),
    onSuccess: invalidate,
  });
}

export function useWorkshopProducts() {
  return useQuery({
    queryKey: queryKeys.workshopProducts(),
    queryFn: () => api.listWorkshopProducts(),
  });
}

export function useCreateWorkshopProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<Product>) => api.createWorkshopProduct(input),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkshopProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<Product> }) =>
      api.updateWorkshopProduct(input.id, input.values),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkshopProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkshopProduct(id),
    onSuccess: invalidate,
  });
}

export function useWorkshopBookings(status?: string) {
  return useQuery({
    queryKey: queryKeys.workshopBookings(status),
    queryFn: () => api.getWorkshopBookings(status),
  });
}

export function useConfirmBooking() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; estimatedTotal: number }) =>
      api.confirmBooking(input.id, input.estimatedTotal),
    onSuccess: invalidate,
  });
}

export function useDeclineBooking() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api.declineBooking(input.id, input.reason),
    onSuccess: invalidate,
  });
}

export function useStartService() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; odometerIn: number; mechanicIds: string[] }) =>
      api.startService(input.id, input.odometerIn, input.mechanicIds),
    onSuccess: invalidate,
  });
}

export function useCompleteService() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: {
      id: string;
      items: ServiceOrderItem[];
      photos: string[];
      mechanicNote: string;
      finalTotal: number;
    }) => api.completeService(input.id, input),
    onSuccess: invalidate,
  });
}

export function useMarkCashPaid() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.markCashPaid(id),
    onSuccess: invalidate,
  });
}

export function useMarkNoShow() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.markNoShow(id),
    onSuccess: invalidate,
  });
}

export function useWorkshopOrders(status?: string) {
  return useQuery({
    queryKey: queryKeys.workshopOrders(status),
    queryFn: () => api.getWorkshopOrders(status),
  });
}

export function useMarkOrderPreparing() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.markOrderPreparing(id),
    onSuccess: invalidate,
  });
}

export function useMarkOrderReady() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.markOrderReady(id),
    onSuccess: invalidate,
  });
}

export function useVerifyPickup() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; pickupCode: string }) =>
      api.verifyPickup(input.id, input.pickupCode),
    onSuccess: invalidate,
  });
}

export function useShipOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; trackingNumber: string }) =>
      api.shipOrder(input.id, input.trackingNumber),
    onSuccess: invalidate,
  });
}

export function useConfirmDelivery() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.confirmDelivery(id),
    onSuccess: invalidate,
  });
}

export function useWorkshopReviews() {
  return useQuery({
    queryKey: queryKeys.workshopReviews(),
    queryFn: () => api.listWorkshopReviews(),
  });
}

export function useReplyReview() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) => api.replyReview(input.id, input.body),
    onSuccess: invalidate,
  });
}

export function useWorkshopDashboard() {
  return useQuery({
    queryKey: queryKeys.workshopDashboard(),
    queryFn: () => api.getWorkshopDashboard(),
  });
}
