import { logger } from "@workspace/core";
import { useCallback, useEffect, useRef, useState } from "react";

export function useFetchConfig<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const res = await fetch(`http://127.0.0.1:4000/backend/${endpoint}`, {
        signal: abortControllerRef.current.signal,
      });
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.ui.warn(`Fetching ${endpoint} aborted`);
      } else {
        logger.ui.error(`Failed to fetch ${endpoint}:`, err);
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
    return () => abortControllerRef.current?.abort();
  }, [fetchData]);

  return {
    data,
    loading,
    refetch: fetchData, // Expose the raw fetchData function as refetch
  };
}
