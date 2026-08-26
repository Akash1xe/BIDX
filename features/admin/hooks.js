"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { adminApi } from "@/features/admin/api";

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.adminStats, queryFn: adminApi.stats });
}

export function useAdminUsers(params = {}) {
  return useQuery({ queryKey: queryKeys.adminUsers(params), queryFn: () => adminApi.listUsers(params) });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...payload }) => adminApi.setUserSuspended(userId, payload),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });
}

export function useAdminAuctions(params = {}) {
  return useQuery({ queryKey: queryKeys.adminAuctions(params), queryFn: () => adminApi.listAuctions(params) });
}

export function useAdminAudit(params = {}) {
  return useQuery({ queryKey: queryKeys.adminAudit(params), queryFn: () => adminApi.listAudit(params) });
}
