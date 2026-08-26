const CHANGE_EVENT = "bidx-demo-notifications-changed";

function storageKey(userId) {
  return `bidx-demo-notifications:${userId}`;
}

export function readDemoNotifications(userId) {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function addDemoNotification(userId, notification) {
  if (typeof window === "undefined" || !userId || !notification?.eventId) return null;
  const existing = readDemoNotifications(userId);
  if (existing.some((item) => item.eventId === notification.eventId)) return null;
  const item = {
    id: `demo:${notification.eventId}`,
    status: "SENT",
    provider: "demo-device",
    sentAt: new Date().toISOString(),
    ...notification,
    userId: String(userId),
  };
  window.localStorage.setItem(storageKey(userId), JSON.stringify([item, ...existing].slice(0, 100)));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId: String(userId) } }));
  return item;
}

export function subscribeDemoNotifications(userId, callback) {
  if (typeof window === "undefined" || !userId) return () => {};
  const refresh = (event) => {
    if (event.type === "storage" && event.key !== storageKey(userId)) return;
    if (event.type === CHANGE_EVENT && event.detail?.userId !== String(userId)) return;
    callback(readDemoNotifications(userId));
  };
  window.addEventListener("storage", refresh);
  window.addEventListener(CHANGE_EVENT, refresh);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener(CHANGE_EVENT, refresh);
  };
}
