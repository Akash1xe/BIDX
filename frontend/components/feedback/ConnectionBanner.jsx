"use client";

import { useEffect, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";

export default function ConnectionBanner() {
  const [state, setState] = useState("online");

  useEffect(() => {
    let restoredTimer;
    function offline() { window.clearTimeout(restoredTimer); setState("offline"); }
    function online() {
      setState("restored");
      restoredTimer = window.setTimeout(() => setState("online"), 3000);
    }
    const initialTimer = window.setTimeout(() => {
      if (!navigator.onLine) setState("offline");
    }, 0);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(restoredTimer);
      window.clearTimeout(initialTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  if (state === "online") return null;
  return <div className={`connection-banner connection-${state}`} role="status" aria-live="polite">{state === "offline" ? <><CloudOff /> You are offline. BidX will reconnect when your network returns.</> : <><Wifi /> Connection restored. Live data is refreshing.</>}</div>;
}
