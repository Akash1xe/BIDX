"use client";

import Link from "next/link";
import { Filter, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AuctionGrid, AuctionGridSkeleton } from "@/components/auction/AuctionGrid";
import MarketplacePagination from "@/components/auction/MarketplacePagination";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import { useAuctions } from "@/features/auctions/hooks";
import { getPagination } from "@/utils/auction";

const STATUSES = ["", "LIVE", "SCHEDULED", "ENDED", "SOLD", "UNSOLD"];

export default function AuctionListing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "";
  const category = searchParams.get("category") || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Number(searchParams.get("limit") || 12);
  const filters = { ...(status && { status }), ...(category && { category }), page, limit };
  const query = useAuctions(filters);
  const auctions = query.data?.items || [];
  const pagination = getPagination(query.data, page);

  function update(name, value) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "page") next.set("page", "1");
    router.push(`/auctions?${next.toString()}`);
  }

  function submitCategory(event) {
    event.preventDefault();
    update("category", new FormData(event.currentTarget).get("category")?.toString().trim() || "");
  }

  function pageHref(nextPage) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPage));
    return `/auctions?${next.toString()}`;
  }

  return (
    <>
      <section className="listing-hero">
        <p className="eyebrow">Marketplace</p>
        <h1>Find your next<br /><em>winning lot.</em></h1>
        <p>Browse auction records directly from the BidX Auction Service.</p>
      </section>
      <section className="listing-shell">
        <aside className="filter-panel">
          <div className="filter-title"><Filter /><strong>Filters</strong></div>
          <label>Status<NativeSelect value={status} onChange={(event) => update("status", event.target.value)}><NativeSelectOption value="">All public statuses</NativeSelectOption>{STATUSES.filter(Boolean).map((item) => <NativeSelectOption value={item} key={item}>{item}</NativeSelectOption>)}</NativeSelect></label>
          <form onSubmit={submitCategory}><label>Category<Input name="category" defaultValue={category} placeholder="e.g. cameras" /></label><Button variant="outline" type="submit">Apply category</Button></form>
          <label>Per page<NativeSelect value={String(limit)} onChange={(event) => update("limit", event.target.value)}><NativeSelectOption value="8">8</NativeSelectOption><NativeSelectOption value="12">12</NativeSelectOption><NativeSelectOption value="20">20</NativeSelectOption></NativeSelect></label>
          <Button asChild variant="ghost"><Link href="/search"><Search /> Advanced search</Link></Button>
        </aside>
        <div className="listing-results">
          <div className="results-heading"><div><span>{query.isSuccess ? pagination.total || auctions.length : "—"}</span><p>auctions found</p></div>{(status || category) && <Button variant="ghost" onClick={() => router.push("/auctions")}>Clear filters</Button>}</div>
          {query.isLoading && <AuctionGridSkeleton count={8} />}
          {query.isError && <QueryError error={query.error} onRetry={query.refetch} />}
          {query.isSuccess && auctions.length > 0 && <><AuctionGrid auctions={auctions} /><MarketplacePagination page={pagination.page} totalPages={pagination.totalPages} createHref={pageHref} /></>}
          {query.isSuccess && auctions.length === 0 && <QueryEmpty />}
        </div>
      </section>
    </>
  );
}

