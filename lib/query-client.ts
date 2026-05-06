import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,      // 1 minute default
      gcTime: 300_000,        // 5 minutes garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
