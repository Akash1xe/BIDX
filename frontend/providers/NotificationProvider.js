"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNotificationFeed } from "@/features/notifications/hooks";
import useAuth from "@/hooks/useAuth";
import { readDemoNotifications, subscribeDemoNotifications } from "@/utils/demo-notifications";
import { notificationHref, notificationId, notificationSubject } from "@/utils/notification";

export const NotificationContext = createContext(null);

function storageKey(userId) {
  return `bidx-notification-read:${userId}`;
}

function readStored(userId) {
  if (typeof window === "undefined" || !userId) return new Set();
  try { return new Set(JSON.parse(window.localStorage.getItem(storageKey(userId)) || "[]")); }
  catch { return new Set(); }
}

export default function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  const query = useNotificationFeed(isAuthenticated ? userId : null);
  const [readIds, setReadIds] = useState(() => new Set());
  const [demoItems, setDemoItems] = useState([]);
  const seenRef = useRef({ userId: null, ids: new Set() });
  const items = useMemo(() => {
    const merged = [...demoItems, ...(query.data || [])];
    const ids = new Set();
    return merged
      .filter((item) => {
        const id = notificationId(item);
        if (!id || ids.has(id)) return false;
        ids.add(id);
        return true;
      })
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  }, [demoItems, query.data]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReadIds(readStored(userId)), 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDemoItems(readDemoNotifications(userId)), 0);
    const unsubscribe = subscribeDemoNotifications(userId, setDemoItems);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [userId]);

  useEffect(() => {
    if (!userId || !items.length) return;
    if (seenRef.current.userId !== userId) {
      seenRef.current = { userId, ids: new Set(items.map(notificationId)) };
      return;
    }
    for (const notification of [...items].reverse()) {
      const id = notificationId(notification);
      if (!id || seenRef.current.ids.has(id)) continue;
      seenRef.current.ids.add(id);
      if (notification.type === "OUTBID") continue;
      toast(notificationSubject(notification), {
        description: notification.status === "FAILED" ? "Email delivery failed; the event is still recorded in BidX." : "A new BidX delivery record is available.",
        action: notification.auctionId ? { label: "View", onClick: () => window.location.assign(notificationHref(notification)) } : undefined,
      });
    }
  }, [items, userId]);

  const commitReadIds = useCallback((next) => {
    setReadIds(next);
    if (userId) window.localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
  }, [userId]);

  const markRead = useCallback((id) => {
    if (!id) return;
    commitReadIds(new Set([...readIds, id]));
  }, [commitReadIds, readIds]);

  const markAllRead = useCallback(() => {
    commitReadIds(new Set(items.map(notificationId).filter(Boolean)));
  }, [commitReadIds, items]);

  const unreadItems = useMemo(() => items.filter((item) => !readIds.has(notificationId(item))), [items, readIds]);
  const value = useMemo(() => ({ items, unreadItems, unreadCount: unreadItems.length, readIds, markRead, markAllRead, query }), [items, markAllRead, markRead, query, readIds, unreadItems]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
