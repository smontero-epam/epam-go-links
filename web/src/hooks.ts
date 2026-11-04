import { useCallback, useEffect, useState } from "react";
import type { Link } from "../../shared/link.ts";
import { describeError, listLinks } from "./api.ts";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export type LinksState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; links: Link[]; query: string };

/**
 * Loads links matching `query`. Later loads keep showing the previous results
 * until new ones arrive, so searching and refreshing don't flash a spinner.
 */
export function useLinks(query: string) {
  const [state, setState] = useState<LinksState>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    reload();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    listLinks(query, controller.signal).then(
      (links) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", links, query });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: describeError(error) });
        }
      },
    );
    return () => controller.abort();
  }, [query, reloadCount]);

  // Visiting a go/ link leaves the page; refresh visit counts when the user comes back.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };
    const refreshWhenRestored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        reload();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenRestored);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshWhenRestored);
    };
  }, [reload]);

  return { state, reload, retry };
}
