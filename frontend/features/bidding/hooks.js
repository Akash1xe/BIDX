"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { biddingApi } from "@/features/bidding/api";
import useAuth from "@/hooks/useAuth";

function prependBid(data, bid) {
  if (!data) return data;
  const items = data.items || [];
  if (items.some((item) => item.id === bid.id)) return data;
  return { ...data, items: [bid, ...items] };
}

export function useAuctionBids(auctionId, page = 1) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.auctionBids(auctionId, page),
    queryFn: () => biddingApi.listAuctionBids(auctionId, { page, limit: 20 }),
    enabled: Boolean(auctionId && isAuthenticated),
    refetchInterval: 15_000,
  });
}

export function useMyBids(page = 1) {
  return useQuery({
    queryKey: queryKeys.myBids(page),
    queryFn: () => biddingApi.listMyBids({ page, limit: 20 }),
    refetchInterval: 20_000,
  });
}

export function usePlaceBid(auctionId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: biddingApi.placeBid,
    onSuccess(data) {
      queryClient.setQueryData(queryKeys.auction(auctionId), (auction) => auction ? {
        ...auction,
        currentBid: data.auction.currentBid,
        highestBidderId: data.auction.highestBidderId,
        version: data.auction.version,
      } : auction);
      queryClient.setQueriesData({ queryKey: ["auction-bids", auctionId] }, (current) => prependBid(current, data.bid));
      queryClient.invalidateQueries({ queryKey: ["my-bids"] });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
    onError() {
      queryClient.invalidateQueries({ queryKey: queryKeys.auction(auctionId) });
      queryClient.invalidateQueries({ queryKey: ["auction-bids", auctionId] });
    },
  });
}
