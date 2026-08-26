import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export default function MarketplacePagination({ page, totalPages, createHref }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <Pagination className="market-pagination">
      <PaginationContent>
        <PaginationItem><PaginationPrevious href={createHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className={page <= 1 ? "pagination-disabled" : ""} /></PaginationItem>
        {pages.map((item) => <PaginationItem key={item}><PaginationLink href={createHref(item)} isActive={item === page}>{item}</PaginationLink></PaginationItem>)}
        <PaginationItem><PaginationNext href={createHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className={page >= totalPages ? "pagination-disabled" : ""} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

