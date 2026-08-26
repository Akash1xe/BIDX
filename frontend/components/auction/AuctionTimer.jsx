"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (days) return `${days}d ${String(hours).padStart(2, "0")}h`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export default function AuctionTimer({ auction, compact = false }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(() => {
    const status = String(auction?.status || "").toUpperCase();
    const start = new Date(auction?.startTime).getTime();
    const end = new Date(auction?.endTime).getTime();

    if (["ENDED", "SOLD", "UNSOLD", "PAYMENT_PENDING"].includes(status) || (end && now >= end)) {
      return { label: "Auction ended", value: "Ended", tone: "ended" };
    }
    if ((status === "SCHEDULED" || status === "DRAFT") && start > now) {
      return { label: "Starts in", value: formatDuration(start - now), tone: "upcoming" };
    }
    return { label: "Ends in", value: formatDuration(end - now), tone: "live" };
  }, [auction, now]);

  return (
    <div className={`auction-timer timer-${state.tone} ${compact ? "auction-timer-compact" : ""}`}>
      <Clock3 />
      <div><span>{state.label}</span><strong>{state.value}</strong></div>
    </div>
  );
}

