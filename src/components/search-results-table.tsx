"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type SearchResultHit = { title: string; url: string; site: string; context?: string | null };

/** Remove newlines from context text. */
function normalizeContext(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").replace(/\\n/g, " ").trim();
}

/** Escape special regex characters in a string for use in RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split text by query (case-insensitive) and return React nodes with matches bolded. */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const re = new RegExp(`(${escapeRegex(query.trim())})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

async function fetchSearchResults(q: string): Promise<SearchResultHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  const data: { results: SearchResultHit[] } = await res.json();
  return data.results ?? [];
}

/**
 * Client component: displays search results from the server API via React Query.
 */
export default function SearchResultsTable() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";

  const { data: hits = [], isLoading: loading, isError, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: query.length > 0,
  });

  const errorMessage = isError ? (error instanceof Error ? error.message : "Search failed") : null;

  if (!query) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 z-50 px-4 pt-2"
      aria-live="polite"
      aria-label="Search results"
    >
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-background shadow-lg ring-1 ring-border/50">
        <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-border bg-muted/50 font-medium">
              <tr>
                <th scope="col" className="px-4 py-2 text-foreground">
                  Title
                </th>
                <th scope="col" className="px-4 py-2 text-muted-foreground">
                  Product
                </th>
              </tr>
            </thead>
            <tbody>
              {errorMessage ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    {errorMessage}
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : hits.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    No results for &quot;{query}&quot;
                  </td>
                </tr>
              ) : (
                hits.map((hit) => (
                  <tr
                    key={`${hit.site}-${hit.url}`}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2">
                      <a
                        href={hit.url}
                        className="font-medium text-blue-600 underline decoration-from-font underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {highlightMatches(hit.title, query)}
                      </a>
                      {hit.context != null && hit.context !== "" && (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          {highlightMatches(normalizeContext(hit.context), query)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 capitalize text-muted-foreground align-top">
                      {hit.site}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
