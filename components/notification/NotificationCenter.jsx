"use client";

import Link from "next/link";
import { Bell, Check, CheckCheck, CircleAlert, LoaderCircle, MailCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useNotifications from "@/hooks/useNotifications";
import { notificationHref, notificationId, notificationSubject } from "@/utils/notification";

function NotificationList({ items, readIds, markRead, empty }) {
  if (!items.length) return <div className="notification-empty"><Bell /><h2>{empty}</h2><p>New delivery records will appear automatically.</p></div>;
  return <div className="notification-list">{items.map((notification) => {
    const id = notificationId(notification);
    const unread = !readIds.has(id);
    return <article key={id} className={unread ? "notification-card notification-card-unread" : "notification-card"}><div className="notification-type-icon">{notification.status === "FAILED" ? <CircleAlert /> : <MailCheck />}</div><div className="notification-card-copy"><div><Badge variant="outline">{String(notification.type).replaceAll("_", " ")}</Badge><Badge className={`delivery-${notification.status.toLowerCase()}`}>{notification.status}</Badge>{unread && <span className="device-unread">Unread on this device</span>}</div><h3>{notificationSubject(notification)}</h3><p>{notification.auctionId ? `Auction ${notification.auctionId}` : "BidX account event"}</p><time>{new Date(notification.sentAt).toLocaleString("en-IN")}</time></div><div className="notification-card-actions">{notification.auctionId && <Button asChild variant="outline" size="sm"><Link href={notificationHref(notification)} onClick={() => markRead(id)}>View auction</Link></Button>}{unread && <Button variant="ghost" size="sm" onClick={() => markRead(id)}><Check /> Mark read</Button>}</div></article>;
  })}</div>;
}

export default function NotificationCenter() {
  const { items, unreadItems, unreadCount, readIds, markRead, markAllRead, query } = useNotifications();
  if (query.isLoading) return <div className="history-loading"><LoaderCircle className="spin" /> Loading notification deliveries…</div>;
  if (query.isError) return <div className="history-error"><strong>Notifications unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;

  return <div className="notification-center"><div className="notification-center-toolbar"><p>The backend records email delivery. Read state is stored only on this device.</p>{unreadCount > 0 && <Button variant="outline" onClick={markAllRead}><CheckCheck /> Mark all read</Button>}</div><Tabs defaultValue="all"><TabsList><TabsTrigger value="all">All <span>{items.length}</span></TabsTrigger><TabsTrigger value="unread">Unread <span>{unreadCount}</span></TabsTrigger></TabsList><TabsContent value="all"><NotificationList items={items} readIds={readIds} markRead={markRead} empty="No notifications" /></TabsContent><TabsContent value="unread"><NotificationList items={unreadItems} readIds={readIds} markRead={markRead} empty="No unread notifications" /></TabsContent></Tabs></div>;
}
