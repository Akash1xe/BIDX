"use client";

import Link from "next/link";
import { ArrowRight, Check, Gavel, Radio, Search, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuctionGrid, AuctionGridSkeleton } from "@/components/auction/AuctionGrid";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import PublicFooter from "@/components/layout/PublicFooter";
import PublicHeader from "@/components/layout/PublicHeader";
import SearchAutocomplete from "@/components/search/SearchAutocomplete";
import { useAuctions } from "@/features/auctions/hooks";

const CATEGORIES = ["Cameras", "Watches", "Collectibles", "Design"];

function AuctionSection({ eyebrow, title, description, query, emptyTitle }) {
  const auctions = query.data?.items || [];

  return (
    <section className="market-section marketplace-home-section">
      <div className="market-toolbar">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="section-description">{description}</p></div>
        <Button asChild variant="outline"><Link href="/auctions">View all <ArrowRight /></Link></Button>
      </div>
      {query.isLoading && <AuctionGridSkeleton />}
      {query.isError && <QueryError error={query.error} onRetry={query.refetch} />}
      {query.isSuccess && auctions.length > 0 && <AuctionGrid auctions={auctions} />}
      {query.isSuccess && auctions.length === 0 && <QueryEmpty title={emptyTitle} />}
    </section>
  );
}

export default function MarketplaceHome() {
  const live = useAuctions({ status: "LIVE", page: 1, limit: 4 });
  const upcoming = useAuctions({ status: "SCHEDULED", page: 1, limit: 4 });

  return (
    <main>
      <PublicHeader />
      <section className="marketplace-hero">
        <div className="marketplace-hero-copy">
          <Badge className="hero-badge"><Sparkles /> Live, verified, yours</Badge>
          <h1>Bid on things<br />worth <em>keeping.</em></h1>
          <p>Discover live auctions from the BidX gateway. Search indexed listings, inspect every lot, and prepare for concurrency-safe real-time bidding.</p>
          <SearchAutocomplete />
          <div className="trust-row"><span><Check /> Verified accounts</span><span><Check /> Live auction states</span><span><Check /> Protected payments</span></div>
        </div>
        <div className="marketplace-signal" aria-label="BidX marketplace architecture">
          <div className="signal-core"><Gavel /><strong>BidX</strong><span>live marketplace</span></div>
          <div className="signal-card signal-rest"><Search /><span>REST discovery</span></div>
          <div className="signal-card signal-live"><Radio /><span>Live bidding ready</span></div>
          <div className="signal-card signal-safe"><ShieldCheck /><span>Gateway protected</span></div>
        </div>
      </section>

      <section className="category-strip" aria-label="Popular auction categories">
        <span>Browse by category</span>
        {CATEGORIES.map((category) => <Link key={category} href={`/auctions?category=${encodeURIComponent(category.toLowerCase())}`}>{category}<ArrowRight /></Link>)}
      </section>

      <AuctionSection eyebrow="Happening now" title="Live auctions" description="Current listings returned directly by the Auction Service through the gateway." query={live} emptyTitle="No live auctions right now" />
      <AuctionSection eyebrow="Plan your next bid" title="Starting soon" description="Scheduled auctions, ready to watch before bidding opens." query={upcoming} emptyTitle="No scheduled auctions right now" />

      <section className="how-section" id="how">
        <div className="how-intro"><p className="eyebrow">Built for confidence</p><h2>From first look<br />to final bid.</h2><p>BidX keeps the distributed services underneath a focused marketplace experience.</p></div>
        <div className="how-list">
          <div><span>01</span><div><Search /><h3>Discover</h3><p>Search Elasticsearch by product, category, condition, price, and status.</p></div></div>
          <div><span>02</span><div><Gavel /><h3>Inspect</h3><p>Review the exact auction state, pricing rules, seller, and countdown.</p></div></div>
          <div><span>03</span><div><WalletCards /><h3>Bid and pay</h3><p>Authenticated bidding and winner payment arrive in the next business phases.</p></div></div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

