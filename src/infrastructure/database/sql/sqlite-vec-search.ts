/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * sqlite-vec accelerated RAG search (Phase 2, [internal ref]).
 *
 * The OPT-IN acceleration path behind `RAG_SQLITE_VEC=on`. It produces the
 * IDENTICAL `EmbeddingSearchResult` contract as the Phase 1 app-side cosine
 * scan, so the acceleration layer is transparent to clients:
 *
 *  1. Build a `vec0` virtual table from the canonical `system_ai_embeddings`
 *     BLOB vectors, sized to the corpus's vector dimension, and run a KNN query
 *     to retrieve the nearest candidate rows by the query embedding.
 *  2. When `RAG_SQLITE_FTS5=on`, also build an FTS5 index over the chunk content
 *     and union the BM25 lexical candidates — recovering exact-term matches that
 *     dense cosine misses (a superset-or-equal candidate set).
 *  3. Rerank the unioned candidates with the SAME cosine-similarity math as
 *     Phase 1 (`cosineSimilarity`), so similarity values and top-k ordering are
 *     rank-equivalent to app-side cosine — vec0 only accelerates *candidate
 *     retrieval*, it never changes the reported score.
 *
 * The indexes are rebuilt per search from the canonical BLOB table (the single
 * source of truth Phase 1 writes), so the accelerated path is always consistent
 * with the latest rebuild without hooking every write path. This trades a little
 * per-query work for correctness; the corpus sizes the frugal default targets
 * make it negligible, and the optimization is OFF unless the operator opts in.
 *
 * SCALING POSTURE (read before enabling on a large corpus): the ephemeral
 * `vec0` (+ optional FTS5) index is rebuilt from ALL embedding rows on EVERY
 * search — `O(N)` per query for N embeddings. For the small per-agent corpora
 * the frugal default targets this is negligible, but it is NOT a free win at
 * scale: for a small corpus where the candidate fan-out covers most rows, this
 * path does strictly MORE work than the Phase 1 single cosine scan (it reads +
 * deserializes the corpus, populates an index, runs KNN, then reranks), so
 * leaving `RAG_SQLITE_VEC` OFF is the right default and can even be faster.
 * `RAG_SQLITE_VEC=on` becomes a net win once the corpus is large enough that
 * skipping the full cosine scan dominates the per-query index-build cost. When
 * the corpus outgrows per-query rebuilds, the next step (out of scope for
 * [internal ref] Phase 2) is a PERSISTENT `vec0` index maintained incrementally on the
 * rebuild/write path instead of rebuilt at search time.
 */

import { resolveRagAcceleration } from '@/domain/models/app/agents/rag-acceleration'
import {
  cosineSimilarity,
  deserializeEmbedding,
} from '@/infrastructure/database/sql/ai-embedding-vector-math'
import { getSqliteVecClient } from '@/infrastructure/database/sql/sqlite-vec-extension'
import { recordDbQueryIssued } from '@/infrastructure/telemetry/db-query-counter'
import type { EmbeddingSearchResult } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { Database as BunSqlite } from 'bun:sqlite'

/** A candidate embedding row read from `system_ai_embeddings`. */
interface CandidateRow {
  readonly rowid: number
  readonly agent_name: string | null
  readonly source_ref: string | null
  readonly content: string
  readonly embedding: unknown
}

interface SearchInput {
  readonly embedding: ReadonlyArray<number>
  readonly query: string
  readonly agentName: string | undefined
  readonly minSimilarity: number
  readonly maxResults: number
}

/** Multiplier on `maxResults` for the candidate fan-out before the rerank. */
const CANDIDATE_FANOUT = 8

/** Serialize a vector into the `vec0` JSON literal `[v1,v2,...]`. */
const toVecLiteral = (embedding: ReadonlyArray<number>): string => `[${embedding.join(',')}]`

/**
 * Read every embedding row (optionally scoped to one agent) from the canonical
 * BLOB table through the accelerated connection. `rowid` is the implicit SQLite
 * rowid of `system_ai_embeddings` — the join key for the `vec0` / FTS5 indexes.
 */
const loadCandidateRows = (
  client: BunSqlite,
  agentName: string | undefined
): ReadonlyArray<CandidateRow> => {
  const where =
    agentName !== undefined
      ? 'WHERE embedding IS NOT NULL AND agent_name = ?'
      : 'WHERE embedding IS NOT NULL'
  const sql = `SELECT rowid, agent_name, source_ref, content, embedding FROM system_ai_embeddings ${where}`
  const stmt = client.query(sql)
  // This runs on the separate raw sqlite-vec handle, invisible to the Drizzle
  // countingLogger — record the statement against the per-request query-count
  // seam explicitly (index-build DDL/inserts are deliberately NOT counted:
  // they are index mechanics, not data queries, and per-row inserts would make
  // the count corpus-size-dependent).

  recordDbQueryIssued()
  return (agentName !== undefined ? stmt.all(agentName) : stmt.all()) as ReadonlyArray<CandidateRow>
}

/**
 * Retrieve the dense ANN candidate rowids via the `vec0` index. Returns the
 * full candidate-row set when the index can't be built (degenerate dimension),
 * so the rerank still runs over everything — never fewer than cosine-only.
 */
const denseCandidateRowids = (
  client: BunSqlite,
  rows: ReadonlyArray<CandidateRow>,
  input: SearchInput
): ReadonlySet<number> => {
  const dim = input.embedding.length
  if (dim === 0 || rows.length === 0) return new Set(rows.map((r) => r.rowid))

  // Build an ephemeral vec0 index sized to the query dimension. A temp table is
  // private to this connection and dropped on close, so concurrent searches and
  // the primary connection never collide.
  // eslint-disable-next-line functional/no-expression-statements -- ephemeral per-search index lifecycle (drop-then-create)
  client.exec('DROP TABLE IF EXISTS temp.rag_vec_idx')
  // eslint-disable-next-line functional/no-expression-statements -- create the dimension-sized vec0 index
  client.exec(`CREATE VIRTUAL TABLE temp.rag_vec_idx USING vec0(embedding float[${dim}])`)

  const insert = client.prepare('INSERT INTO temp.rag_vec_idx(rowid, embedding) VALUES (?, ?)')

  rows.forEach((row) => {
    const vec = deserializeEmbedding(row.embedding)
    if (vec.length === dim) {
      // eslint-disable-next-line functional/no-expression-statements -- per-row index insert
      insert.run(row.rowid, toVecLiteral(vec))
    }
  })

  const k = Math.min(rows.length, Math.max(input.maxResults * CANDIDATE_FANOUT, input.maxResults))
  // Raw-handle statement — see the note in loadCandidateRows.

  recordDbQueryIssued()
  const knn = client
    .query('SELECT rowid FROM temp.rag_vec_idx WHERE embedding MATCH ? AND k = ? ORDER BY distance')
    .all(toVecLiteral(input.embedding), k) as ReadonlyArray<{ readonly rowid: number }>
  // eslint-disable-next-line functional/no-expression-statements -- release the ephemeral index
  client.exec('DROP TABLE IF EXISTS temp.rag_vec_idx')
  return new Set(knn.map((r) => r.rowid))
}

/**
 * Retrieve FTS5 BM25 lexical candidate rowids for the literal query terms. The
 * FTS5 index is built over the candidate content (scoped to the same agent), so
 * its rowids align with `system_ai_embeddings.rowid`. Returns an empty set when
 * the lexical hybrid is off or the query yields no terms.
 */
const lexicalCandidateRowids = (
  client: BunSqlite,
  rows: ReadonlyArray<CandidateRow>,
  query: string
): ReadonlySet<number> => {
  const terms = query.trim()
  if (terms.length === 0 || rows.length === 0) return new Set()

  // eslint-disable-next-line functional/no-expression-statements -- ephemeral per-search FTS5 index lifecycle
  client.exec('DROP TABLE IF EXISTS temp.rag_fts_idx')
  // eslint-disable-next-line functional/no-expression-statements -- create the FTS5 lexical index (content-only, external rowid)
  client.exec('CREATE VIRTUAL TABLE temp.rag_fts_idx USING fts5(content)')
  const insert = client.prepare('INSERT INTO temp.rag_fts_idx(rowid, content) VALUES (?, ?)')

  rows.forEach((row) => {
    // eslint-disable-next-line functional/no-expression-statements -- per-row index insert
    insert.run(row.rowid, row.content)
  })

  // Quote each whitespace-delimited token as an FTS5 phrase so punctuation /
  // reserved characters in a literal query term never trip the MATCH grammar.
  const matchExpr = terms
    .split(/\s+/)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' OR ')

  const hits = (() => {
    try {
      // Raw-handle statement — see the note in loadCandidateRows.

      recordDbQueryIssued()
      return client
        .query('SELECT rowid FROM temp.rag_fts_idx WHERE rag_fts_idx MATCH ? ORDER BY rank')
        .all(matchExpr) as ReadonlyArray<{ readonly rowid: number }>
    } catch {
      return [] as ReadonlyArray<{ readonly rowid: number }>
    }
  })()
  // eslint-disable-next-line functional/no-expression-statements -- release the ephemeral FTS5 index
  client.exec('DROP TABLE IF EXISTS temp.rag_fts_idx')
  return new Set(hits.map((r) => r.rowid))
}

/**
 * Run the accelerated search when `RAG_SQLITE_VEC=on` and the sqlite-vec
 * connection loaded successfully. Returns `undefined` to signal "acceleration
 * unavailable — use the Phase 1 app-side cosine path" so the caller falls back
 * transparently.
 */
export const searchSqliteVec = (
  input: SearchInput
): ReadonlyArray<EmbeddingSearchResult> | undefined => {
  const accel = resolveRagAcceleration(process.env)
  if (!accel.sqliteVec) return undefined
  const client = getSqliteVecClient()
  if (client === undefined) return undefined

  const rows = loadCandidateRows(client, input.agentName)
  const denseIds = denseCandidateRowids(client, rows, input)
  const lexicalIds = accel.fts5Hybrid
    ? lexicalCandidateRowids(client, rows, input.query)
    : new Set<number>()

  // Union the dense ANN candidates with the lexical candidates — hybrid recall
  // is a superset-or-equal of dense-only. Lexical matches are kept regardless of
  // the cosine floor so a near-orthogonal exact-term match is never filtered out.
  const candidates = rows.filter((r) => denseIds.has(r.rowid) || lexicalIds.has(r.rowid))

  const scored = candidates.map((row) => ({
    agentName: row.agent_name,
    sourceRef: row.source_ref,
    content: row.content,
    similarity: cosineSimilarity(input.embedding, deserializeEmbedding(row.embedding)),
    lexical: lexicalIds.has(row.rowid),
  }))

  // Keep dense hits above the floor PLUS every lexical hit (its dense similarity
  // may be near-zero by design). Rank by similarity (descending), then trim.
  const kept = scored.filter((row) => row.lexical || row.similarity >= input.minSimilarity)
  return kept
    .toSorted((a, b) => b.similarity - a.similarity)
    .slice(0, input.maxResults)
    .map(({ agentName, sourceRef, content, similarity }) => ({
      agentName,
      sourceRef,
      content,
      similarity,
    }))
}
