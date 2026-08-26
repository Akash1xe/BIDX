"use client";

import { useEffect } from "react";
import useRealtime from "@/hooks/useRealtime";

export default function useAuctionSocket(auctionId) {
  const realtime = useRealtime();

  useEffect(() => {
    if (!auctionId || realtime.status !== "connected") return;
    realtime.joinAuction(auctionId);
    return () => realtime.leaveAuction(auctionId);
  }, [auctionId, realtime]);

  return realtime.status;
}

