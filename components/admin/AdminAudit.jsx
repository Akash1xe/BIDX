"use client";

import { useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminPagination from "@/components/admin/AdminPagination";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import { useAdminAudit } from "@/features/admin/hooks";
import { adminId, adminPagination, shortId } from "@/utils/admin";

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const query = useAdminAudit({ page, limit: 50 });
  const pagination = adminPagination(query.data, page);

  if (query.isLoading) return <div className="history-loading"><LoaderCircle className="spin" /> Loading audit events…</div>;
  if (query.isError) return <QueryError title="Audit history is unavailable" error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.items?.length) return <QueryEmpty title="No audit events yet" description="Audited moderation actions will appear here." />;

  return <div className="admin-list"><div className="admin-audit-note"><ShieldCheck /><p>These entries are server-owned records created after successful admin actions.</p></div><div className="table-shell admin-table"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((entry) => <TableRow key={adminId(entry)}><TableCell>{new Date(entry.createdAt).toLocaleString("en-IN")}</TableCell><TableCell>{shortId(entry.actorId)}</TableCell><TableCell><Badge className={entry.action === "USER_SUSPENDED" ? "admin-suspended" : "admin-active"}>{entry.action}</Badge></TableCell><TableCell><strong>{entry.targetType || "resource"}</strong><small>{shortId(entry.targetId)}</small></TableCell><TableCell>{entry.details?.reason || "No reason recorded"}</TableCell></TableRow>)}</TableBody></Table></div><AdminPagination pagination={pagination} onPage={setPage} /></div>;
}
