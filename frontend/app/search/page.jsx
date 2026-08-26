import PublicFooter from "@/components/layout/PublicFooter";
import PublicHeader from "@/components/layout/PublicHeader";
import SearchMarketplace from "@/components/search/SearchMarketplace";

export const metadata = { title: "Search auctions — BidX", description: "Search the BidX auction index." };

export default function SearchPage() {
  return <main><PublicHeader /><SearchMarketplace /><PublicFooter /></main>;
}

