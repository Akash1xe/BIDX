"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { searchApi } from "@/features/search/api";

export function useSearch(params = {}) {
  return useQuery({
    queryKey: queryKeys.search(params),
    queryFn: () => searchApi.search(params),
  });
}

export function useSearchSuggestions(query) {
  return useQuery({
    queryKey: queryKeys.suggestions(query),
    queryFn: () => searchApi.suggest(query),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

