import { Button } from "@/components/ui/button";

export default function AdminPagination({ pagination, onPage }) {
  if (pagination.totalPages <= 1) return null;
  return <div className="admin-pagination"><Button variant="outline" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</Button><span>Page <strong>{pagination.page}</strong> of {pagination.totalPages} · {pagination.total} records</span><Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</Button></div>;
}
