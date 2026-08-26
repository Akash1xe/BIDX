"use client";

import Link from "next/link";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import useNotifications from "@/hooks/useNotifications";
import { notificationHref, notificationId, notificationSubject } from "@/utils/notification";

export default function NotificationBell() {
  const { items, unreadCount, readIds, markRead, markAllRead, query } = useNotifications();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button className="icon-button notification-bell" aria-label={`${unreadCount} unread notifications`}>{unreadCount ? <BellRing size={17} /> : <Bell size={17} />}{unreadCount > 0 && <span>{Math.min(unreadCount, 99)}</span>}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notification-menu">
        <div className="notification-menu-heading"><DropdownMenuLabel>Notifications</DropdownMenuLabel>{unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCheck /> Mark all read</Button>}</div>
        <DropdownMenuSeparator />
        {query.isLoading && <p className="notification-menu-state">Checking deliveries…</p>}
        {query.isError && <p className="notification-menu-state notification-menu-error">{query.error.message}</p>}
        {!query.isLoading && !query.isError && !items.length && <p className="notification-menu-state">No notifications</p>}
        {items.slice(0, 4).map((notification) => {
          const id = notificationId(notification);
          const unread = !readIds.has(id);
          return <DropdownMenuItem asChild key={id}><Link href={notificationHref(notification)} className={`notification-menu-item ${unread ? "notification-unread" : ""}`} onClick={() => markRead(id)}><span className="notification-dot" /><div><strong>{notificationSubject(notification)}</strong><small>{new Date(notification.sentAt).toLocaleString("en-IN")}</small></div></Link></DropdownMenuItem>;
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/dashboard/notifications" className="notification-view-all">View notification center</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
