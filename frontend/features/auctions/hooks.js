"use client";

import { useQuery } from "@tanstack/react-query";
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
  });
}

