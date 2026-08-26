"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AuctionGrid, AuctionGridSkeleton } from "@/components/auction/AuctionGrid";
import MarketplacePagination from "@/components/auction/MarketplacePagination";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import SearchAutocomplete from "@/components/search/SearchAutocomplete";
import { useSearch } from "@/features/search/hooks";
import { getPagination } from "@/utils/auction";

const CONDITION_OPTIONS = ["", "NEW", "LIKE_NEW", "USED", "REFURBISHED"];
const SORT_OPTIONS = ["relevance", "price_asc", "price_desc", "ending_soon", "newest"];

function SearchMarketplaceContent({ params, searchParams }) {
  const router = useRouter();
  const page = Math.max(1, Number(params.page || 1));
  const request = { ...params, page, limit: Number(params.limit || 12) };
  const query = useSearch(request);
  const results = query.data?.results || [];
  const pagination = getPagination(query.data, page);
  const [filters, setFilters] = useState({ status: params.status || "", category: params.category || "", condition: params.condition || "", minPrice: params.minPrice || "", maxPrice: params.maxPrice || "", sort: params.sort || "relevance" });

  function apply(event) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(filters).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    next.set("page", "1");
    router.push(`/search?${next.toString()}`);
  }

  function pageHref(nextPage) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPage));
    return `/search?${next.toString()}`;
  }

  return (
    <>
      <section className="search-page-hero"><p className="eyebrow">Elasticsearch discovery</p><h1>Search every<br /><em>auction signal.</em></h1><SearchAutocomplete key={params.q || "empty"} defaultValue={params.q || ""} compact /></section>
      <section className="search-layout">
        <form className="filter-panel search-filter-panel" onSubmit={apply}>
          <div className="filter-title"><SlidersHorizontal /><strong>Refine results</strong></div>
          <label>Status<Input value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} placeholder="LIVE,SCHEDULED" /></label>
          <label>Category<Input value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} placeholder="cameras" /></label>
          <label>Condition<NativeSelect value={filters.condition} onChange={(event) => setFilters({ ...filters, condition: event.target.value })}><NativeSelectOption value="">Any condition</NativeSelectOption>{CONDITION_OPTIONS.filter(Boolean).map((item) => <NativeSelectOption key={item} value={item}>{item.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelect></label>
          <div className="price-filter"><label>Min price<Input type="number" min="0" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} /></label><label>Max price<Input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} /></label></div>
          <label>Sort<NativeSelect value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>{SORT_OPTIONS.map((item) => <NativeSelectOption value={item} key={item}>{item.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelect></label>
          <Button type="submit" className="primary-button"><Filter /> Apply filters</Button>
        </form>
        <div className="listing-results">
          <div className="results-heading"><div><span>{query.isSuccess ? pagination.total || results.length : "—"}</span><p>indexed results</p></div>{params.q && <small>for “{params.q}”</small>}</div>
          {query.isLoading && <AuctionGridSkeleton count={8} />}
          {query.isError && <QueryError title="Search is unavailable" error={query.error} onRetry={query.refetch} />}
          {query.isSuccess && results.length > 0 && <><AuctionGrid auctions={results} /><MarketplacePagination page={pagination.page} totalPages={pagination.totalPages} createHref={pageHref} /></>}
          {query.isSuccess && results.length === 0 && <QueryEmpty title="No indexed auctions matched" description="Try a broader keyword or remove one of the filters." />}
        </div>
      </section>
    </>
  );
}

export default function SearchMarketplace() {
  const searchParams = useSearchParams();
  const params = Object.fromEntries(searchParams.entries());
  const filterKey = [params.status, params.category, params.condition, params.minPrice, params.maxPrice, params.sort].join("|");

  return <SearchMarketplaceContent key={filterKey} params={params} searchParams={searchParams} />;
}
