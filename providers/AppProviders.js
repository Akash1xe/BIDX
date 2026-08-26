"use client";

import QueryProvider from "@/providers/QueryProvider";
import AuthProvider from "@/providers/AuthProvider";
import RealtimeProvider from "@/providers/RealtimeProvider";
import NotificationProvider from "@/providers/NotificationProvider";
import { Toaster } from "@/components/ui/sonner";

export default function AppProviders({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <RealtimeProvider>
          <NotificationProvider>
            {children}
            <Toaster position="top-right" />
          </NotificationProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
