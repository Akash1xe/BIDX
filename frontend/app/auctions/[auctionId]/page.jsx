import AuctionDetails from "@/components/auction/AuctionDetails";
import PublicFooter from "@/components/layout/PublicFooter";
import PublicHeader from "@/components/layout/PublicHeader";

export const metadata = { title: "Auction details — BidX" };

export default function AuctionDetailsPage() {
  return <main><PublicHeader /><AuctionDetails /><PublicFooter /></main>;
}

