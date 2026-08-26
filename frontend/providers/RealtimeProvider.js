"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/constants/query-keys";
import { createBidSocket } from "@/lib/socket";
import useAuth from "@/hooks/useAuth";
import { formatMoney } from "@/utils/auction";

export const RealtimeContext = createContext(null);

function addSocketBid(data, payload) {
  if (!data) return data;
  const bid = {
    id: payload.bidId,
    auctionId: payload.auctionId,
    bidderId: payload.bidderId,
    amount: payload.amount,
    status: "ACCEPTED",
    createdAt: payload.createdAt,
  };
  if ((data.items || []).some((item) => item.id === bid.id)) return data;
  return { ...data, items: [bid, ...(data.items || [])] };
}

export default function RealtimeProvider({ children }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    const token = session?.tokens?.accessToken;
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      const statusTimer = window.setTimeout(() => setStatus("disconnected"), 0);
      return () => window.clearTimeout(statusTimer);
    }

    const socket = createBidSocket(token);
    socketRef.current = socket;
    const statusTimer = window.setTimeout(() => setStatus("connecting"), 0);

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("unavailable"));
    socket.on("bid:new", (payload) => {
      queryClient.setQueryData(queryKeys.auction(payload.auctionId), (auction) => auction ? {
        ...auction,
        currentBid: payload.currentBid,
        highestBidderId: payload.bidderId,
      } : auction);
      queryClient.setQueriesData({ queryKey: ["auction-bids", payload.auctionId] }, (data) => addSocketBid(data, payload));
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["my-bids"] });
    });
    socket.on("bid:outbid", (payload) => {
      toast.warning(`You were outbid. The new bid is ${formatMoney(payload.amount)}.`, {
        action: { label: "View", onClick: () => window.location.assign(`/auctions/${payload.auctionId}`) },
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.auction(payload.auctionId) });
      queryClient.invalidateQueries({ queryKey: ["my-bids"] });
    });
    socket.connect();

    return () => {
      window.clearTimeout(statusTimer);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [queryClient, session?.tokens?.accessToken]);

  const joinAuction = useCallback((auctionId) => {
    socketRef.current?.emit("auction:join", auctionId);
  }, []);

  const leaveAuction = useCallback((auctionId) => {
    socketRef.current?.emit("auction:leave", auctionId);
  }, []);

  const value = useMemo(() => ({ status, joinAuction, leaveAuction }), [joinAuction, leaveAuction, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
