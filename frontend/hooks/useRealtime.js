"use client";

import { useContext } from "react";
import { RealtimeContext } from "@/providers/RealtimeProvider";

export default function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used within RealtimeProvider");
  return context;
}

