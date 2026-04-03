import { useEffect, useState, useTransition } from "react";
import { config } from "../../config";

export interface BranchesFetchState {
  branches: string[];
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

export const useBranches = (enabled: boolean): BranchesFetchState => {
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const load = (signal: AbortSignal) => {
    startTransition(async () => {
      try {
        setError(false);
        const res = await fetch(
          `https://api.github.com/repos/${config.ADJ_GITHUB_REPO}/branches?per_page=100`,
          { signal: AbortSignal.any([signal, AbortSignal.timeout(config.BRANCHES_FETCH_TIMEOUT)]) },
        );
        const data = await res.json();
        setBranches(data.map((b: { name: string }) => b.name));
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(true);
        }
      }
    });
  };

  const refetch = () => {
    const controller = new AbortController();
    load(controller.signal);
  };

  useEffect(() => {
    if (enabled) {
      const controller = new AbortController();
      load(controller.signal);
      return () => controller.abort();
    }
  }, [enabled]);

  return { branches, isLoading, error, refetch };
};
