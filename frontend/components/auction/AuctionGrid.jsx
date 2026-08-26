import AuctionCard from "@/components/auction/AuctionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuctionId } from "@/utils/auction";

export function AuctionGrid({ auctions }) {
  return <div className="auction-grid">{auctions.map((auction) => <AuctionCard key={getAuctionId(auction)} auction={auction} />)}</div>;
}

export function AuctionGridSkeleton({ count = 4 }) {
  return (
    <div className="auction-grid" aria-label="Loading auctions">
      {Array.from({ length: count }, (_, index) => (
        <div className="auction-card auction-skeleton" key={index}>
          <Skeleton className="skeleton-media" />
          <div className="auction-card-body"><Skeleton className="skeleton-line wide" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-price" /></div>
        </div>
      ))}
    </div>
  );
}

