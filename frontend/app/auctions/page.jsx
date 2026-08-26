import AuctionListing from "@/components/auction/AuctionListing";
import PublicFooter from "@/components/layout/PublicFooter";
import PublicHeader from "@/components/layout/PublicHeader";

export const metadata = { title: "Auctions — BidX", description: "Browse live and scheduled BidX auctions." };

export default function AuctionsPage() {
  return <main><PublicHeader /><AuctionListing /><PublicFooter /></main>;
}

