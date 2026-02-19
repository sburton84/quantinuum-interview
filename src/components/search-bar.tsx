'use client';

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import { SearchIcon } from "lucide-react";

const SEARCH_PARAM = "q";
const DEBOUNCE_MS = 300;

export default function SearchBar({ placeholder = "Search documentation…" }: { placeholder?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [value, setValue] = useState(() => searchParams.get(SEARCH_PARAM) ?? "");
    const [debouncedValue] = useDebounce(value, DEBOUNCE_MS);

    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
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
        router.replace(url, { scroll: false });
    }, [debouncedValue, pathname, router, searchParams]);

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
                role="searchbox"
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background py-2 pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background hover:border-input/80 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
    );
}