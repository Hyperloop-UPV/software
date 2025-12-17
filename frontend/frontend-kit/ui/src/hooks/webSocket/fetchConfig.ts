import { logger } from "@workspace/core";
import { useEffect, useState } from "react";

export function useFetchConfig<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const response = fetch(`http://127.0.0.1:4000/backend/${endpoint}`, {
      signal: controller.signal,
    });

    response
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") logger.ui.warn("Fetching aborted");
        else logger.ui.error("Failed to fetch:", err);
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [endpoint]);

  return {
    data,
    loading,
  };
}
