generate-db:
	python3 scripts/load_searchindex_to_sqlite.py --site tket public/tket/searchindex.js
	python3 scripts/load_searchindex_to_sqlite.py --site guppy public/guppy/searchindex.js
