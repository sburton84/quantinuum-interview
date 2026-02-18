'use client';

import { SearchIcon } from "lucide-react";

export default function SearchBar({ placeholder }: { placeholder: string }) {
    function handleSearch(term: string) {
        console.log(term);
    }

    return (
        <div className="relative flex flex-1 shrink-0">
            <label htmlFor="search" className="sr-only">
                Search
            </label>
            <input
                className="w-full rounded-xl border shadow"
                placeholder="Search..."
                onChange={(e) => {
                    handleSearch(e.target.value);
                }}
            />
            <SearchIcon className="w-6 h-6 mb-3 inline" aria-label="search icon" />
        </div>
    );
}