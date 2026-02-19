import { searchAllIndicesFromDb } from "@/lib/search-db";
import { NextRequest } from "next/server";

/**
 * GET /api/search?q=...
 * Server-side only: queries data/search.db.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return Response.json({ results: [] });
  }
  const results = searchAllIndicesFromDb(q);
  return Response.json({ results });
}
