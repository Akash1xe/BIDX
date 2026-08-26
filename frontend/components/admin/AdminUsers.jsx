"use client";

import { useState } from "react";
import { LoaderCircle, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminPagination from "@/components/admin/AdminPagination";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import { useAdminUsers, useSuspendUser } from "@/features/admin/hooks";
import useAuth from "@/hooks/useAuth";
import { adminId, adminPagination, shortId } from "@/utils/admin";

function ModerationAction({ account, currentUserId }) {
  const mutation = useSuspendUser();
  const [reason, setReason] = useState("");
  const id = adminId(account);
  const suspended = Boolean(account.isSuspended);
  const isSelf = String(id) === String(currentUserId);

  async function confirm() {
    try {
      await mutation.mutateAsync({ userId: id, isSuspended: !suspended, reason: suspended ? undefined : reason.trim() || undefined });
      toast.success(suspended ? "User access restored." : "User suspended and audit event recorded.");
      setReason("");
    } catch (error) { toast.error(error.message); }
  }

  if (isSelf) return <span className="admin-self-label">Current admin</span>;
  return <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant={suspended ? "outline" : "destructive"}>{suspended ? <ShieldCheck /> : <ShieldAlert />}{suspended ? "Restore" : "Suspend"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{suspended ? "Restore this user's access?" : "Suspend this user?"}</AlertDialogTitle><AlertDialogDescription>{suspended ? "The account can sign in and use authorized BidX features again." : "The backend will block this account and write an immutable admin audit record."}</AlertDialogDescription></AlertDialogHeader>{!suspended && <label className="admin-reason-label">Reason (optional)<Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Policy violation, suspected abuse…" maxLength={160} /></label>}<AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant={suspended ? "default" : "destructive"} disabled={mutation.isPending} onClick={confirm}>{mutation.isPending ? "Saving…" : suspended ? "Restore access" : "Suspend user"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminUsers({ ...(search && { q: search }), page, limit: 20 });
  const pagination = adminPagination(query.data, page);

  function submit(event) { event.preventDefault(); setPage(1); setSearch(q.trim()); }

  return <div className="admin-list"><form className="admin-toolbar" onSubmit={submit}><div className="admin-search"><Search /><Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name or email" aria-label="Search users" /></div><Button type="submit">Search</Button>{search && <Button type="button" variant="ghost" onClick={() => { setQ(""); setSearch(""); setPage(1); }}>Clear</Button>}</form>{query.isLoading && <div className="history-loading"><LoaderCircle className="spin" /> Loading user accounts…</div>}{query.isError && <QueryError title="Users are unavailable" error={query.error} onRetry={() => query.refetch()} />}{query.isSuccess && !query.data?.items?.length && <QueryEmpty title="No users found" description="Try another name or email address." />}{query.isSuccess && query.data?.items?.length > 0 && <><div className="table-shell admin-table"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Verification</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((account) => <TableRow key={adminId(account)}><TableCell><strong>{account.name || "Unnamed user"}</strong><small>{account.email}</small><small>{shortId(adminId(account))}</small></TableCell><TableCell><Badge variant="outline">{account.role || "USER"}</Badge></TableCell><TableCell>{account.isVerified ? <span className="admin-ok">Verified</span> : <span className="admin-muted">Pending</span>}</TableCell><TableCell><Badge className={account.isSuspended ? "admin-suspended" : "admin-active"}>{account.isSuspended ? "SUSPENDED" : "ACTIVE"}</Badge>{account.suspendedReason && <small className="admin-reason">{account.suspendedReason}</small>}</TableCell><TableCell>{account.createdAt ? new Date(account.createdAt).toLocaleString("en-IN") : "—"}</TableCell><TableCell><ModerationAction account={account} currentUserId={user.id} /></TableCell></TableRow>)}</TableBody></Table></div><AdminPagination pagination={pagination} onPage={setPage} /></>}</div>;
}
