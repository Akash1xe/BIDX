"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { paymentsApi } from "@/features/payments/api";

export function usePayments(page = 1) {
  return useQuery({
    queryKey: queryKeys.payments(page),
    queryFn: () => paymentsApi.listMine({ page, limit: 20 }),
    refetchInterval: 20_000,
  });
}

export function useAuctionPayment(auctionId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payment(auctionId),
    queryFn: () => paymentsApi.getByAuction(auctionId),
    enabled: Boolean(auctionId && enabled),
    retry: false,
    refetchInterval(query) {
      return query.state.data?.status === "CREATED" ? 10_000 : false;
    },
  });
}

export function useCreatePaymentOrder(auctionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => paymentsApi.createOrder(auctionId),
    onSuccess(payment) {
      queryClient.setQueryData(queryKeys.payment(auctionId), payment);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useConfirmPayment(auctionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.confirm,
    onSuccess(payment) {
      queryClient.setQueryData(queryKeys.payment(auctionId), payment);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.auction(auctionId) });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
    },
  });
}
