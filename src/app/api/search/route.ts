import { searchAllIndicesFromDb } from "@/lib/search-db";
import { NextRequest } from "next/server";
import { trace } from '@opentelemetry/api'

/**
 * GET /api/search?q=...
 * Server-side only: queries data/search.db.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return Response.json({ results: [] });
  }

  return await trace
    .getTracer('quantinuum-docs')
    .startActiveSpan(
      'fetchSearchResults',
      { attributes: { 'query': q } },
      async (span) => {
        try {
          const results = searchAllIndicesFromDb(q);
          return Response.json({ results });
        } catch (error) {
          if (span) {
            span.recordException(error);
          }
        }
        finally {
          span.end();
        }
      })
}
