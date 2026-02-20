"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import SearchResultsTable, {
  type SearchResultHit,
} from "@/components/search-results-table";

const SEARCH_PARAM = "q";
const DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LISTBOX_ID = "search-results-listbox";

async function fetchSearchResults(q: string): Promise<SearchResultHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  const data: { results: SearchResultHit[] } = await res.json();
  return data.results ?? [];
}

export default function SearchBar({
  placeholder = "Search documentation…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get(SEARCH_PARAM)?.trim() ?? "";

  const [value, setValue] = useState(() => searchParams.get(SEARCH_PARAM) ?? "");
  const [debouncedValue] = useDebounce(value, DEBOUNCE_MS);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Query to fetch the search results
  const { data: hits = [], isLoading: loading, isError, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: query.length > 0,
  });

  const errorMessage = isError
    ? (error instanceof Error ? error.message : "Search failed")
    : null;

  useEffect(() => {
    // Ensure the active index still makes sense given the new search results
    if (!query || hits.length === 0) {
      setActiveIndex(-1);
    } else {
      setActiveIndex((i) =>
        i >= hits.length ? hits.length - 1 : i < 0 ? 0 : i
      );
    }
  }, [query, hits.length]);

  const isFirstRun = useRef(true);
  const clearedByEscapeRef = useRef(false);

  useEffect(() => {
    if (isFirstRun.current) {
      // Page is being loaded for the first time, so we don't need to update the URL
      isFirstRun.current = false;
      return;
    }

    if (clearedByEscapeRef.current) {
      if (debouncedValue.trim()) {
        // The user has cleared the search by pressing Escape, but the 
        // debounced value has not yet been cleared, so we want to avoid
        // updating the URL with the obsolete search string.
        return;
      }
      clearedByEscapeRef.current = false;
    }

    const params = new URLSearchParams(searchParams.toString());
    const trimmed = debouncedValue.trim();
    if (trimmed) {
      params.set(SEARCH_PARAM, trimmed);
    } else {
      params.delete(SEARCH_PARAM);
    }

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    // Update the URL to include the new search query
    router.replace(url, { scroll: false });
  }, [debouncedValue, pathname, router, searchParams]);

  const hasResults = query.length > 0;
  const activeOptionId =
    hasResults && activeIndex >= 0 && hits[activeIndex]
      ? `${SEARCH_RESULTS_LISTBOX_ID}-option-${activeIndex}`
      : undefined;

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < hits.length - 1 ? i + 1 : i));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : -1));
        break;
      case "Enter":
        if (activeIndex >= 0 && hits[activeIndex]) {
          e.preventDefault();
          // Navigate to the selected search result
          router.push(hits[activeIndex].url);
        }
        break;
      case "Escape":
        e.preventDefault();
        if (value.trim()) {
          clearedByEscapeRef.current = true;
          setValue("");
          // Clear the search query from the URL
          router.replace(pathname, { scroll: false });
        }
        setActiveIndex(-1);
        return;
    }
  };

  return (
    <div className="relative flex flex-1 shrink-0 max-w-xl">
      <label htmlFor="search" className="sr-only">
        Search documentation
      </label>
      <SearchIcon
        size={16}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id="search"
        type="search"
        role="combobox"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-expanded={hasResults}
        aria-controls={hasResults ? SEARCH_RESULTS_LISTBOX_ID : undefined}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        className="w-full h-8 rounded-md border border-input bg-background py-2 pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background hover:border-input/80 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <SearchResultsTable
        query={query}
        hits={hits}
        loading={loading}
        error={errorMessage}
        activeIndex={activeIndex}
        resultsId={SEARCH_RESULTS_LISTBOX_ID}
      />
    </div>
  );
}
