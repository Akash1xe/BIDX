"use client";

import QueryProvider from "@/providers/QueryProvider";
import AuthProvider from "@/providers/AuthProvider";
import RealtimeProvider from "@/providers/RealtimeProvider";
import NotificationProvider from "@/providers/NotificationProvider";
import ConnectionBanner from "@/components/feedback/ConnectionBanner";
import { Toaster } from "@/components/ui/sonner";

export default function AppProviders({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <RealtimeProvider>
          <NotificationProvider>
            <ConnectionBanner />
            {children}
            <Toaster position="top-right" />
          </NotificationProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
