import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth";
import { searchKeys } from "@/lib/queryKeys";

const SEARCH_DEBOUNCE_MS = 300;

export function useUserSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      setDebouncedQuery("");
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: searchKeys.users(debouncedQuery),
    queryFn: () => authService.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  return {
    ...searchQuery,
    debouncedQuery,
  };
}
