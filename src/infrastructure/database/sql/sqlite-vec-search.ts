/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveRagAcceleration } from '@/domain/services/rag/rag-acceleration'
import {
  cosineSimilarity,
  deserializeEmbedding,
} from '@/infrastructure/database/sql/ai-embedding-vector-math'
import { getSqliteVecClient } from '@/infrastructure/database/sql/sqlite-vec-extension'
import type { EmbeddingSearchResult } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { Database as BunSqlite } from 'bun:sqlite'

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

const CANDIDATE_FANOUT = 8

const toVecLiteral = (embedding: ReadonlyArray<number>): string => `[${embedding.join(',')}]`

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
  return (agentName !== undefined ? stmt.all(agentName) : stmt.all()) as ReadonlyArray<CandidateRow>
}

const denseCandidateRowids = (
  client: BunSqlite,
  rows: ReadonlyArray<CandidateRow>,
  input: SearchInput
): ReadonlySet<number> => {
  const dim = input.embedding.length
  if (dim === 0 || rows.length === 0) return new Set(rows.map((r) => r.rowid))

  client.exec('DROP TABLE IF EXISTS temp.rag_vec_idx')
  client.exec(`CREATE VIRTUAL TABLE temp.rag_vec_idx USING vec0(embedding float[${dim}])`)

  const insert = client.prepare('INSERT INTO temp.rag_vec_idx(rowid, embedding) VALUES (?, ?)')

  rows.forEach((row) => {
    const vec = deserializeEmbedding(row.embedding)
    if (vec.length === dim) {
      insert.run(row.rowid, toVecLiteral(vec))
    }
  })

  const k = Math.min(rows.length, Math.max(input.maxResults * CANDIDATE_FANOUT, input.maxResults))
  const knn = client
    .query('SELECT rowid FROM temp.rag_vec_idx WHERE embedding MATCH ? AND k = ? ORDER BY distance')
    .all(toVecLiteral(input.embedding), k) as ReadonlyArray<{ readonly rowid: number }>
  client.exec('DROP TABLE IF EXISTS temp.rag_vec_idx')
  return new Set(knn.map((r) => r.rowid))
}

const lexicalCandidateRowids = (
  client: BunSqlite,
  rows: ReadonlyArray<CandidateRow>,
  query: string
): ReadonlySet<number> => {
  const terms = query.trim()
  if (terms.length === 0 || rows.length === 0) return new Set()

  client.exec('DROP TABLE IF EXISTS temp.rag_fts_idx')
  client.exec('CREATE VIRTUAL TABLE temp.rag_fts_idx USING fts5(content)')
  const insert = client.prepare('INSERT INTO temp.rag_fts_idx(rowid, content) VALUES (?, ?)')

  rows.forEach((row) => {
    insert.run(row.rowid, row.content)
  })

  const matchExpr = terms
    .split(/\s+/)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' OR ')

  const hits = (() => {
    try {
      return client
        .query('SELECT rowid FROM temp.rag_fts_idx WHERE rag_fts_idx MATCH ? ORDER BY rank')
        .all(matchExpr) as ReadonlyArray<{ readonly rowid: number }>
    } catch {
      return [] as ReadonlyArray<{ readonly rowid: number }>
    }
  })()
  client.exec('DROP TABLE IF EXISTS temp.rag_fts_idx')
  return new Set(hits.map((r) => r.rowid))
}

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

  const candidates = rows.filter((r) => denseIds.has(r.rowid) || lexicalIds.has(r.rowid))

  const scored = candidates.map((row) => ({
    agentName: row.agent_name,
    sourceRef: row.source_ref,
    content: row.content,
    similarity: cosineSimilarity(input.embedding, deserializeEmbedding(row.embedding)),
    lexical: lexicalIds.has(row.rowid),
  }))

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
