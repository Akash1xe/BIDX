import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function QueryError({ title = "We could not load this data", error, onRetry }) {
  return (
    <Empty className="query-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><AlertTriangle /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{error?.message || "The BidX gateway could not be reached. Please try again."}</EmptyDescription>
      </EmptyHeader>
      {onRetry && <EmptyContent><Button variant="outline" onClick={onRetry}>Try again</Button></EmptyContent>}
    </Empty>
  );
}

export function QueryEmpty({ title = "No auctions found", description = "Try changing your filters or return later for new listings.", action }) {
  return (
    <Empty className="query-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

