"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { notificationsApi } from "@/features/notifications/api";

export function useNotificationFeed(userId, { limit = 50, offset = 0 } = {}) {
  return useQuery({
    queryKey: queryKeys.notifications({ userId, limit, offset }),
    queryFn: () => notificationsApi.listMine(userId, { limit, offset }),
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    retry: false,
  });
}
