"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({ error, reset }) {
  return <main className="route-state-page"><section><AlertTriangle /><p className="eyebrow">Request interrupted</p><h1>This page could not finish loading.</h1><p>{error?.message || "BidX encountered an unexpected frontend error."}</p>{error?.digest && <small>Reference: {error.digest}</small>}<div><Button onClick={reset} className="primary-button"><RotateCcw /> Try again</Button><Button asChild variant="outline"><Link href="/">Return home</Link></Button></div></section></main>;
}
