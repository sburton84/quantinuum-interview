#!/usr/bin/env python3
"""
Load Sphinx searchindex.js into an SQLite database.

Usage:
  python load_searchindex_to_sqlite.py <searchindex.js> [--site NAME] [--db PATH]

Example:
  python load_searchindex_to_sqlite.py public/tket/searchindex.js --site tket --db data/search.db
  python load_searchindex_to_sqlite.py public/guppy/searchindex.js --site guppy --db data/search.db

  To load both sites into one database, run twice with the same --db and different --site.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

PREFIX = "Search.setIndex("


def load_searchindex(path: Path) -> dict:
    """Read searchindex.js and return the parsed JSON object."""
    text = path.read_text(encoding="utf-8").strip()
    if not text.startswith(PREFIX):
        raise ValueError(f"Invalid format: expected file to start with {PREFIX!r}")
    # Content is Search.setIndex( + JSON + ) or );
    rest = text[len(PREFIX) :]
    if not rest.endswith(")") and not rest.endswith(");"):
        raise ValueError("Invalid format: expected file to end with ) or );")
    if rest.endswith(");"):
        json_str = rest[:-2]
    else:
        json_str = rest[:-1]
    return json.loads(json_str)


def init_db(conn: sqlite3.Connection) -> None:
    """Create tables if they don't exist."""

    sql = """
        CREATE TABLE IF NOT EXISTS sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site_name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            title TEXT,
            FOREIGN KEY (site_id) REFERENCES sites(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_site_path ON documents(site_id, path);

        CREATE VIRTUAL TABLE IF NOT EXISTS terms USING fts5(
            term,
            tokenize="trigram"
        );

        CREATE TABLE IF NOT EXISTS term_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            context TEXT NOT NULL,
            FOREIGN KEY (term_id) REFERENCES terms(id),
            FOREIGN KEY (document_id) REFERENCES documents(id)
        );
        CREATE INDEX IF NOT EXISTS idx_term_instances_term ON term_instances(term_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS titles USING fts5(
            title,
            tokenize="trigram"
        );

        CREATE TABLE IF NOT EXISTS title_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            anchor TEXT,
            FOREIGN KEY (title_id) REFERENCES titles(id),
            FOREIGN KEY (document_id) REFERENCES documents(id)
        );
        CREATE INDEX IF NOT EXISTS idx_title_instances_title ON title_instances(title_id);
    """
    conn.executescript(sql)


def insert_index(conn: sqlite3.Connection, data: dict, site: str) -> None:
    """Insert one Sphinx index into the database."""

    # Get or insert the site entry
    site_id = conn.execute("SELECT id FROM sites WHERE site_name = ?", (site,)).fetchone()
    site_id = site_id[0] if site_id is not None else None
    if not site_id:
        site_id = conn.execute("INSERT INTO sites (site_name) VALUES (?)", (site,)).lastrowid

    print(f"Inserting index for site {site} with id {site_id}")

    filenames = data.get("filenames") or []
    titles = data.get("titles") or []
    document_ids = []
    
    # Insert an entry for each document with its title
    for idx, path in enumerate(filenames):
        if path.startswith("build/_downloads"):
            # There are some duplicate documents in the index, we'll ignore those
            document_ids.append(None)
        else:
            document_id = conn.execute(
                "INSERT OR REPLACE INTO documents (site_id, path, title) VALUES (?, ?, ?)",
                (site_id, path, titles[idx]),
            ).lastrowid
            document_ids.append(document_id)

    terms = data.get("terms") or {}

    # Insert an entry for each term in the document content
    for term, document_idxs in terms.items():
        if not isinstance(document_idxs, list):
            continue

        # Get or insert the term entry
        term_id = conn.execute("SELECT rowid FROM terms WHERE term = ?", (term,)).fetchone()
        term_id = term_id[0] if term_id is not None else None
        if not term_id:
            term_id = conn.execute("INSERT INTO terms (term) VALUES (?)", (term,)).lastrowid

        for document_idx in document_idxs:
            document_id = document_ids[document_idx]
            if document_id is None:
                # Index was to a duplicate document, we'll ignore those
                continue

            # Determine the path to the document
            document_path = Path("sphinx")

            # The TKet and Guppy documentation repos have a slightly different directory structure
            if site == "tket":
                document_path = document_path / "pytket-docs" / "docs"
            elif site == "guppy":
                document_path = document_path / "guppy-docs" / "sphinx"

            document_path = document_path / filenames[document_idx]

            # Read some context from the document
            context = ""
            if Path(document_path).exists():
                document_content = Path(document_path).read_text(encoding="utf-8")
                term_index = document_content.find(term)
                context_begin = term_index - 50 if term_index - 50 > 0 else 0
                context_end = term_index + 50 if term_index + 50 < len(document_content) else len(document_content)
                context = document_content[context_begin:context_end]
            else:
                raise Exception(f"Document {document_path} not found")
                
            conn.execute(
                "INSERT OR REPLACE INTO term_instances (term_id, document_id, context) VALUES (?, ?, ?)",
                (term_id, document_id, context),
            )

    alltitles = data.get("alltitles") or {}

    # Insert an entry for each title
    # We'll ignore the "titleterms" in the file and just insert the whole title
    # into the database because the titles are all relatively short and SQLite's
    # fts5 table will handle substring search efficiently.
    for title, document_idxs in alltitles.items():
        if not isinstance(document_idxs, list):
            continue

        # Get or insert the title entry
        title_id = conn.execute("SELECT rowid FROM titles WHERE title = ?", (title,)).fetchone()
        title_id = title_id[0] if title_id is not None else None
        if not title_id:
            title_id = conn.execute("INSERT INTO titles (title) VALUES (?)", (title,)).lastrowid
        
        for document_idx_and_anchor in document_idxs:
            document_idx = document_idx_and_anchor[0]
            anchor = document_idx_and_anchor[1]

            document_id = document_ids[document_idx]
            if document_id is None:
                # Index was to a duplicate document, we'll ignore those
                continue

            conn.execute(
                "INSERT OR REPLACE INTO title_instances (title_id, document_id, anchor) VALUES (?, ?, ?)",
                (title_id, document_id, anchor),
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Load Sphinx searchindex.js into SQLite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "searchindex",
        type=Path,
        help="Path to searchindex.js file",
    )
    parser.add_argument(
        "--site",
        default="default",
        help="Site/source name (e.g. tket, guppy) [default: default]",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("data/search.db"),
        help="Path to SQLite database [default: data/search.db]",
    )
    args = parser.parse_args()

    if not args.searchindex.exists():
        print(f"Error: file not found: {args.searchindex}", file=sys.stderr)
        return 1

    try:
        data = load_searchindex(args.searchindex)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error parsing index: {e}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(args.db)
    try:
        init_db(conn)
        insert_index(conn, data, args.site)
        conn.commit()
        print(f"Loaded {args.searchindex} (site={args.site}) into {args.db}")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
