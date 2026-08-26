"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { auctionsApi } from "@/features/auctions/api";

export function useAuctions(filters = {}) {
  return useQuery({
    queryKey: queryKeys.auctions(filters),
    queryFn: () => auctionsApi.list(filters),
  });
}

export function useAuction(auctionId) {
  return useQuery({
    queryKey: queryKeys.auction(auctionId),
    queryFn: () => auctionsApi.getById(auctionId),
    enabled: Boolean(auctionId),
    refetchInterval(query) {
      const status = query.state.data?.status;
      return status === "LIVE" || status === "SCHEDULED" ? 15_000 : false;
    },
  });
}

function useAuctionMutation(mutationFn, auctionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess(data) {
      if (auctionId && data?.id) queryClient.setQueryData(queryKeys.auction(auctionId), data);
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useCreateAuction() {
  return useAuctionMutation(auctionsApi.create);
}

export function useUpdateAuction(auctionId) {
  return useAuctionMutation((payload) => auctionsApi.update(auctionId, payload), auctionId);
}

export function useDeleteAuction(auctionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auctionsApi.remove(auctionId),
    onSuccess() {
      queryClient.removeQueries({ queryKey: queryKeys.auction(auctionId) });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useStartAuction(auctionId) {
  return useAuctionMutation(() => auctionsApi.start(auctionId), auctionId);
}

export function useEndAuction(auctionId) {
  return useAuctionMutation(() => auctionsApi.end(auctionId), auctionId);
}
