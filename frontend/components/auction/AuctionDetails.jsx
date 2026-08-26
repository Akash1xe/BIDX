"use client";

import Link from "next/link";
import { ArrowLeft, Images, ShieldCheck, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AuctionTimer from "@/components/auction/AuctionTimer";
import ProductMedia from "@/components/auction/ProductMedia";
import BidHistory from "@/components/bidding/BidHistory";
import BidPanel from "@/components/bidding/BidPanel";
import RealtimeBadge from "@/components/bidding/RealtimeBadge";
import { QueryError } from "@/components/feedback/QueryState";
import { useAuction } from "@/features/auctions/hooks";
import useAuctionSocket from "@/hooks/useAuctionSocket";
import { formatCondition, formatMoney, getCurrentPrice, getProduct } from "@/utils/auction";

function DetailsSkeleton() {
  return <div className="auction-details details-loading"><Skeleton className="details-media-skeleton" /><div><Skeleton className="skeleton-line" /><Skeleton className="details-title-skeleton" /><Skeleton className="details-copy-skeleton" /><Skeleton className="details-panel-skeleton" /></div></div>;
}

export default function AuctionDetails() {
  const params = useParams();
  const auctionId = params?.auctionId;
  const query = useAuction(auctionId);
  const realtimeStatus = useAuctionSocket(auctionId);

  if (query.isLoading) return <DetailsSkeleton />;
  if (query.isError) return <div className="detail-state"><QueryError title="Auction unavailable" error={query.error} onRetry={query.refetch} /></div>;

  const auction = query.data;
  const product = getProduct(auction);
  const price = getCurrentPrice(auction);
  const minimum = price > Number(auction.startingPrice || 0) ? price + Number(auction.minimumIncrement || 0) : Number(auction.startingPrice || 0);
  const images = product.images || [];

  return (
    <section className="detail-page">
      <Link href="/auctions" className="detail-back"><ArrowLeft /> Back to auctions</Link>
      <div className="auction-details">
        <div className="product-gallery">
          <div className="gallery-primary"><ProductMedia auction={auction} /></div>
          {images.length > 1 && <div className="gallery-thumbnails">{images.slice(1, 4).map((image, index) => <img src={image} alt={`${product.name} view ${index + 2}`} key={image} />)}</div>}
          {!images.length && <div className="gallery-note"><Images /> The seller has not uploaded product images.</div>}
        </div>
        <div className="auction-information">
          <div className="detail-badges"><Badge className={`status-${String(auction.status).toLowerCase()}`}>{auction.status}</Badge><Badge variant="outline">{product.category || "Uncategorized"}</Badge></div>
          <h1>{product.name || "Untitled auction"}</h1>
          <p className="product-condition">Condition · {formatCondition(product.condition || "Used")}</p>
          <p className="product-description">{product.description || "No product description was supplied by the seller."}</p>
          <div className="detail-price-row"><div><span>Current bid</span><strong>{formatMoney(price)}</strong></div><AuctionTimer auction={auction} /></div>
          <div className="auction-facts"><div><span>Starting price</span><strong>{formatMoney(auction.startingPrice)}</strong></div><div><span>Minimum increment</span><strong>{formatMoney(auction.minimumIncrement)}</strong></div><div><span>Next valid bid</span><strong>{formatMoney(minimum)}</strong></div></div>
          <div className="seller-line"><UserRound /><div><span>Seller ID</span><strong>{auction.sellerId || "Unavailable"}</strong></div></div>
          <RealtimeBadge status={realtimeStatus} />
          <BidPanel auction={auction} auctionId={auctionId} minimum={minimum} />
          <div className="detail-security"><ShieldCheck /> Backend state remains authoritative for price, status, role, and bid eligibility.</div>
        </div>
      </div>
      <BidHistory auctionId={auctionId} />
    </section>
  );
}
