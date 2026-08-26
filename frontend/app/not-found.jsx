import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="route-state-page"><section><Compass /><p className="eyebrow">404 · Lot not found</p><h1>This BidX page does not exist.</h1><p>The route may have moved, or the auction link may no longer be valid.</p><div><Button asChild className="primary-button"><Link href="/auctions">Browse auctions</Link></Button><Button asChild variant="outline"><Link href="/">Return home</Link></Button></div></section></main>;
}
