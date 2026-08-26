import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return <main className="root-loading" aria-label="Loading BidX"><Skeleton className="root-loading-nav" /><div><Skeleton className="root-loading-copy" /><Skeleton className="root-loading-panel" /></div></main>;
}
