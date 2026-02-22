## Running

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Implementation

The Python script at `scripts/load_searchindex_to_sqlite.py` is used for loading the seach terms from the `searchindex.js` files into an SQLite database, which
then allows more efficient searching. This script requires that the docs repos are cloned into `sphinx/guppy-docs` and `sphinx/pytket-docs` as described in https://github.com/Quantinuum/docs-sample-project/blob/main/projects/searchbar.md because it will read some context for each search term from the docs, as the
`searchindex.js` files do not contain any context.

The upstream `@quantinuum/quantinuum-ui` package did not support passing children into the NavBar component. The repo was forked (e.g. `sburton84/quantinuum-ui`) so that the NavBar could be extended to accept and render children, allowing the search bar and other layout elements to be integrated into the header.
Because the dependency is installed from a GitHub repo (e.g. `github:sburton84/quantinuum-ui`), but the “files” field in the package’s `package.json` lists only `dist`, I had to commit the `dist` folder to the repo to get everything to work, even though I would not normally do so.

While the `quantinuum-ui` library uses Radix-UI elements, the framework in `docs-sample-project` did not use it, and for a simple search input the Radix-UI
`TextField` does not seem like it would add much, so I chose not to add the extra dependency and to just use a standard `<input>` element with Tailwind 
styling. Also, while the `quantinuum-ui` library uses Radix-UI icons, the `docs-sample-project` framework already uses some icons from Lucide, so I used a
Lucide icon for the search icon, but it may be worth considering switching both to standardise on Radix-UI icons, to improve consistency and reduce the number
of dependencies.

TanStack React Query was used for fetching and caching search results. It handles loading/error state, request deduplication, and caching keyed by query string, which fits the “search as you type” UX.

The SQLite database stores search terms in an FTS5 virtual table and uses `ORDER BY rank` when retrieving them, which by default will order results using 
the built-in BM25 ranking. Terms found in titles are always given higher priority than terms found only in the body of a document, but within each of these
two categories the results are ordered by their BM25 ranking. This seems to mimic the behaviour of the search feature that Sphinx can generate.

## Assumptions

The format of `searchindex.js`is not clearly documented in the Sphinx documentation, so I had to make a best guess to the meaning and usage of the elements
these files contain. There were some peculiarities, such as the `searchindex.js` for TKet including duplicate path entries nested under `_build/download`, which
I assumed can just be ignored.

The task brief says to include the search score in the results list. This would be easy to add, as the database returns this number, but I do not
believe this would be useful to the user, as the specific number is meaningless to them. All the user cares about is the ordering of the results, and
they are ordered according to the ranking. Also, because the terms from document titles and terms from document bodies are indexed separately in separate
tables, the ranking numbers would not be comparable to each other, and displaying these both would just be confusing.

## Trade-offs

The task description specifically says to use an explicit GET request for fetching search results, and that is what has been used, but it may be worth
investigating whether it's worth using React Server Components. React Server Components can help improve first page load by rendering more of the page
on the server and reducing the amount of requests, but this may be of limited use for a search function, and they do seem to make the implementation
more complicated, so it may not be worth the trade-off in this case.

Relying on the data in the `searchindex.js` is somewhat limiting. For example, while the titles include an anchor string, to locate that title within
its page, the individual search terms *only* include the index of a specific page. As such, choosing a search result goes to the root of the relevant
page, not to the closest anchor. If we indexed each document ourselves (or used a third-party implementation such as ElasticSearch) then this would
be able to use the existing anchors to associate search terms with a more specific location in each page.

## Future improvements

Currently there are some differences in the layouts between the docs repos (e.g. `pytket-docs/docs/` vs `guppy-docs/sphinx/`). Because of this the Python script
have to include special cases for each product, whereas this could be simplified if the directory structures were made more consistent.

SQLite is used for the search DB for initial simplicity, but for a production deployment a dedicated RDBMS (MySQL or Postgres) would likely offer better
performance and maintainability. But even better than this would be to use a dedicated search solution such as ElasticSearch, which will be able to
index the entire content of each document and provide much more search features (fuzzy-search, synonyms, etc).

OpenTelemetry (via `@vercel/otel`) is used for collecting for telemetry and logging. To make use of that data however, an exporter and a backend
(e.g. Jaeger, Prometheus, etc) are required.
