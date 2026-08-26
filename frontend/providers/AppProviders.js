"use client";

import QueryProvider from "@/providers/QueryProvider";

export default function AppProviders({ children }) {
  return <QueryProvider>{children}</QueryProvider>;
}

