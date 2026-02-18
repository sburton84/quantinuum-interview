'use client';

import { SearchIcon } from "lucide-react";

export default function SearchBar({ placeholder = "Search documentation…" }: { placeholder?: string }) {
    function handleSearch(term: string) {
        console.log(term);
    }

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
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background py-2 pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background hover:border-input/80 disabled:cursor-not-allowed disabled:opacity-50"
            />

        </div>
    );
}