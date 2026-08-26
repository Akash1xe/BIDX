"use client";

import QueryProvider from "@/providers/QueryProvider";
import AuthProvider from "@/providers/AuthProvider";
import RealtimeProvider from "@/providers/RealtimeProvider";
import { Toaster } from "@/components/ui/sonner";

export default function AppProviders({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <RealtimeProvider>
          {children}
          <Toaster position="top-right" />
        </RealtimeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
