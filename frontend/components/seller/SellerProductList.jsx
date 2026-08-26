"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, PackageOpen, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteProduct, useMyProducts } from "@/features/products/hooks";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";

function ProductCard({ product }) {
  const remove = useDeleteProduct(product.id);
  return <article className="seller-product-card"><div className="seller-product-image">{product.images?.[0] ? <img src={product.images[0]} alt="" /> : <PackageOpen />}</div><div><span>{product.category} · {String(product.condition).replaceAll("_", " ")}</span><h2>{product.name}</h2><p>{product.description || "No description supplied."}</p><small>{product.id}</small></div><div className="seller-product-actions"><Button asChild className="primary-button"><Link href={`/seller/auctions/create?productId=${encodeURIComponent(product.id)}`}>Create auction <ArrowRight /></Link></Button><Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()} aria-label={`Delete ${product.name}`}><Trash2 /> Delete</Button></div>{remove.error && <p className="seller-form-error">{remove.error.message}</p>}</article>;
}

export default function SellerProductList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const query = useMyProducts({ page, limit: 12, q: q || undefined });
  const pagination = query.data?.pagination || { page, totalPages: 1, total: 0 };

  return <div className="seller-product-list"><label className="seller-product-search"><Search /><Input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Search your products" /><span>{query.isSuccess ? `${pagination.total} products` : "Loading…"}</span></label>{query.isLoading && <div className="history-loading"><LoaderCircle className="spin" /> Loading inventory…</div>}{query.isError && <QueryError title="Inventory is unavailable" error={query.error} onRetry={() => query.refetch()} />}{query.isSuccess && !query.data?.items?.length && <QueryEmpty title="No products found" description={q ? "No owned product matches this search." : "Create your first product, then attach it to an auction."} action={<Button asChild className="primary-button"><Link href="/seller/products/create">Create product</Link></Button>} />}{query.data?.items?.length > 0 && <div className="seller-product-grid">{query.data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>}{pagination.totalPages > 1 && <div className="seller-pagination"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {pagination.totalPages}</span><Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}</div>;
}
