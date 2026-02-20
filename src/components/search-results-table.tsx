"use client";

import { useEffect, useRef } from "react";

export type SearchResultHit = {
  title: string;
  url: string;
  site: string;
  context?: string | null;
};

// Remove newlines from context text.
function normalizeContext(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").replace(/\\n/g, " ").trim();
}

// Escape special regex characters in a string for use in RegExp.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Split text by query (case-insensitive) and return React nodes with matches bolded.
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

type SearchResultsTableProps = {
  query: string;
  hits: SearchResultHit[];
  loading: boolean;
  error: string | null;
  activeIndex: number;
  resultsId: string;
};

// Displays search results with listbox semantics and keyboard support.
// Receives all data and state from parent SearchBar (arrow keys, Enter, Escape handled there).
export default function SearchResultsTable({
  query,
  hits,
  loading,
  error,
  activeIndex,
  resultsId,
}: SearchResultsTableProps) {
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) {
      return;
    }

    // Get the elements for the selected option and the header
    const listbox = listboxRef.current;
    const option = listbox.querySelector(
      `[id="${resultsId}-option-${activeIndex}"]`
    ) as HTMLElement | null;
    const thead = listbox.querySelector("thead");
    if (!option || !thead) {
      return;
    }

    // Scroll the selected option into view
    option.scrollIntoView({ block: "nearest", behavior: "instant" });

    const headerHeight = thead.getBoundingClientRect().height;
    const optionTop = option.offsetTop;

    // If the selected option is behind the header, scroll the listbox further to ensure it is visible
    if (optionTop - listbox.scrollTop < headerHeight) {
      listbox.scrollTop = optionTop - headerHeight;
    }
  }, [activeIndex, resultsId]);

  // If there's no query, don't render the table
  if (!query) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 z-50 px-4 pt-2"
      aria-live="polite"
      aria-label="Search results"
    >
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-background shadow-lg ring-1 ring-border/50">
        <div
          ref={listboxRef}
          role="listbox"
          id={resultsId}
          aria-label="Search results"
          className="max-h-[min(60vh,24rem)] overflow-y-auto"
        >
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted font-medium shadow-sm">
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
              {error ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    {error}
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
                hits.map((hit, i) => (
                  <tr
                    key={`${hit.site}-${hit.url}`}
                    id={`${resultsId}-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`border-b border-border/50 hover:bg-muted/30 ${i === activeIndex ? "bg-muted/50" : ""}`}
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
