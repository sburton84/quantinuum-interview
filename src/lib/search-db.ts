import Database from "better-sqlite3";
import path from "path";
import { logs } from '@opentelemetry/api-logs';

const logger = logs.getLogger('search-db');

/**
 * Search result shape (matches existing SearchResultHit).
 */
export type SearchResultHit = { title: string; url: string; site: string, context: string | null, rank: number };

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "search.db");

let db: Database.Database | null = null;

function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database | null {
  if (db !== null) return db;
  try {
    db = new Database(dbPath, { readonly: true });
    return db;
  } catch (e) {
    console.error(e)
    return null;
  }
}

/**
 * Escape a string for use in SQLite FTS5 MATCH as a phrase:
 * wrap in double quotes and escape any inner double quotes.
 */
function escapeFts5Phrase(q: string): string {
  return '"' + q.replace(/"/g, '""') + '"';
}

/**
 * Search the SQLite database (schema from scripts/load_searchindex_to_sqlite.py).
 * Uses the `titles` FTS5 table and joins to title_instances, documents, sites
 * to build title + url + site. Does not touch raw searchindex.js files.
 * Database connection is opened once on first query and reused.
 */
export function searchAllIndicesFromDb(
  query: string,
  dbPath: string = DEFAULT_DB_PATH
): SearchResultHit[] {
  logger.emit({
    severityText: 'INFO',
    body: 'Searching database',
    attributes: {
      query: query,
    },
  });

  const q = query.trim();
  if (!q) {
    return [];
  }

  const connection = getDb(dbPath);
  if (!connection) return [];

  try {
    const ftsQuery = escapeFts5Phrase(q);
    const titleQuery = connection.prepare(`
      SELECT t.title, ti.anchor, d.path, s.site_name, rank
      FROM titles t
      JOIN title_instances ti ON ti.title_id = t.rowid
      JOIN documents d ON d.id = ti.document_id
      JOIN sites s ON s.id = d.site_id
      WHERE t.title MATCH ?
      ORDER BY rank
      LIMIT 30
    `);

    const termQuery = connection.prepare(`
      SELECT t.term, ti.context, d.path, d.title, s.site_name, rank
      FROM terms t
      JOIN term_instances ti ON ti.term_id = t.rowid
      JOIN documents d ON d.id = ti.document_id
      JOIN sites s ON s.id = d.site_id
      WHERE t.term MATCH ?
      ORDER BY rank
      LIMIT 30
    `);

    // Fetch the results from the database
    const titleRows = titleQuery.all(ftsQuery) as { title: string; anchor: string | null; path: string; site_name: string, rank: number }[];
    const termRows = termQuery.all(ftsQuery) as { term: string; context: string; path: string; title: string; site_name: string, rank: number }[];

    // Because of ORDER BY, the results will already be sorted by rank (BM25) ascending so highest ranked results are first
    // We will leave the title results and term results sorted separately so, when combined, the title results are still all first
    // rather than sorting them after combining which would intermingle them

    const seen = new Set<string>();
    const results: SearchResultHit[] = [];
    for (const row of titleRows) {
      let base = `/${row.site_name}/`;
      if (row.site_name === "tket") {
        // TKet documentation is nested in a user-guide subdirectory, whereas Guppy is not
        base += "user-guide/";
      }

      let pathSeg = row.path.startsWith("/") ? row.path.slice(1) : row.path;
      pathSeg = pathSeg.replace(/(.md|.ipynb)$/, ".html");

      const url = row.anchor
        ? `${base}${pathSeg}#${row.anchor}`
        : `${base}${pathSeg}`;

      // Prevent duplicate results
      const key = `${row.site_name}:${url}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      results.push({ title: row.title, url, site: row.site_name, context: null, rank: row.rank });
    }

    for (const row of termRows) {
      let base = `/${row.site_name}/`;
      if (row.site_name === "tket") {
        // TKet documentation is nested in a user-guide subdirectory, whereas Guppy is not
        base += "user-guide/";
      }

      let pathSeg = row.path.startsWith("/") ? row.path.slice(1) : row.path;
      pathSeg = pathSeg.replace(/(.md|.ipynb)$/, ".html");
      const url = `${base}${pathSeg}`;

      // Prevent duplicate results
      const key = `${row.site_name}:${url}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      results.push({ title: row.title, url, site: row.site_name, context: row.context, rank: row.rank });
    }

    logger.emit({
      severityText: 'INFO',
      body: 'Results found',
      attributes: {
        query: query,
        resultCount: results.length,
      },
    });

    return results;
  } catch (e) {
    logger.emit({
      severityText: 'ERROR',
      body: 'Error searching database',
      attributes: {
        error: e,
      },
    });

    return [];
  }
}
