// ── Generic data-fetching hook ────────────────────────────────
// Thin SWR-like hook: fetch on mount + refetch helpers.
// No external dependencies — just React state + fetch.

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiQueryOptions {
  /** Skip the initial fetch (e.g. if params aren't ready) */
  enabled?: boolean;
}

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiQueryOptions = {},
): UseApiQueryResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (isMounted.current) {
        setData(result);
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    if (enabled) {
      fetch();
    }
    return () => {
      isMounted.current = false;
    };
  }, [fetch, enabled]);

  return { data, isLoading, error, refetch: fetch };
}
