import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AuctionTimer from "@/components/auction/AuctionTimer";
import ProductMedia from "@/components/auction/ProductMedia";
import { formatCondition, formatMoney, getAuctionId, getCurrentPrice, getProduct } from "@/utils/auction";

export default function AuctionCard({ auction }) {
  const id = getAuctionId(auction);
  const product = getProduct(auction);
  const status = String(auction.status || "UNKNOWN").toUpperCase();

  return (
    <article className="auction-card">
      <Link href={`/auctions/${id}`} className="auction-card-link" aria-label={`View ${product.name || "auction"}`}>
        <div className="auction-media">
          <ProductMedia auction={auction} />
          <Badge className={`status-badge status-${status.toLowerCase()}`}>
            {status === "LIVE" && <span className="live-dot" />}{status}
          </Badge>
          <span className="card-open"><ArrowUpRight /></span>
        </div>
        <div className="auction-card-body">
          <div>
            <p className="eyebrow">{product.category || "Uncategorized"} · {formatCondition(product.condition || "Used")}</p>
            <h3>{product.name || "Untitled auction"}</h3>
          </div>
          <div className="auction-meta">
            <div><span>{getCurrentPrice(auction) > Number(auction.startingPrice || 0) ? "Current bid" : "Starting at"}</span><strong>{formatMoney(getCurrentPrice(auction))}</strong></div>
            <AuctionTimer auction={auction} compact />
          </div>
        </div>
      </Link>
    </article>
  );
}

