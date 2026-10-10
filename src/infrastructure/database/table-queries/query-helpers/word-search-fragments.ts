/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  isWordSearchValue,
  parseWordSearchQuery,
  WORD_SEARCH_OPERATOR,
  type WordSearchValue,
} from '@/domain/models/app/tables/word-search-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import {
  SQLITE_FTS_RECORD_ID_COLUMN,
  sqliteFtsTableName,
} from '@/infrastructure/database/schema/command-search-fts-ddl'
import {
  pgWordSearchVectorSql,
  toPgWordTsQuery,
  toSqliteWordMatch,
} from '@/infrastructure/database/schema/word-search-ddl'
import { generateSqlConditionFragment } from '../filter-operators'
import { validateColumnName } from '../statement/validation'
import type { SQL } from 'drizzle-orm'

/**
 * The records query's side of the word search on `long-text` fields declared
 * `fullTextSearch` (`?q=`): the WHERE condition one field contributes, and the
 * relevance order an unsorted search is returned in.
 *
 * SQLite reads the command palette's FTS5 mirror `fts__<table>` through a
 * column filter; PostgreSQL repeats the GIN expression index's own expression.
 * Both receive the query as ONE bound string built from quoted words, never as
 * spliced text (standing rule S3).
 */

/** A filter leaf carrying a word search over its `field`. */
interface WordSearchLeaf {
  readonly field: string
  readonly operator: typeof WORD_SEARCH_OPERATOR
  readonly value: WordSearchValue
}

/** Whether a filter node is a word-search leaf. */
export const isWordSearchLeaf = (node: unknown): node is WordSearchLeaf => {
  if (typeof node !== 'object' || node === null) return false
  const candidate = node as Readonly<Record<string, unknown>>
  return (
    candidate['operator'] === WORD_SEARCH_OPERATOR &&
    typeof candidate['field'] === 'string' &&
    isWordSearchValue(candidate['value'])
  )
}

const isSqlite = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'

/** The FTS5 mirror a table's word search reads (SQLite). */
const mirrorOf = (value: WordSearchValue): string =>
  sqliteFtsTableName(sanitizeTableName(value.table))

/**
 * The WHERE condition of one word-search leaf: the rows whose field holds every
 * term. No term means no row. On SQLite a table without the full-text mirror
 * (no `id`) falls back to the substring search of that field.
 */
export const wordSearchCondition = (leaf: WordSearchLeaf): Readonly<SQL> => {
  const { field, value } = leaf
  if (isSqlite() && !value.mirrored) {
    return generateSqlConditionFragment(field, 'contains', value.query)
  }
  const terms = parseWordSearchQuery(value.query)
  if (terms.length === 0) return sql`(1 = 0)`
  if (isSqlite()) {
    const mirror = sql.identifier(mirrorOf(value))
    return sql`CAST(${sql.identifier('id')} AS TEXT) IN (
      SELECT ${sql.identifier(SQLITE_FTS_RECORD_ID_COLUMN)} FROM ${mirror}
      WHERE ${mirror} MATCH ${toSqliteWordMatch(terms, [field])}
    )`
  }
  return sql`${pgWordSearchVectorSql(field)} @@ to_tsquery('simple', ${toPgWordTsQuery(terms)})`
}

/** Every word-search leaf of a filter tree, depth first. */
const wordSearchLeavesOf = (nodes: readonly unknown[]): readonly WordSearchLeaf[] =>
  nodes.flatMap((node): readonly WordSearchLeaf[] => {
    if (isWordSearchLeaf(node)) return [node]
    if (typeof node !== 'object' || node === null) return []
    const group = node as { readonly and?: unknown; readonly or?: unknown }
    const children = Array.isArray(group.and) ? group.and : Array.isArray(group.or) ? group.or : []
    return wordSearchLeavesOf(children)
  })

/** What an unsorted word search adds to the list statement. */
export interface WordSearchRelevance {
  /** Emitted before `SELECT` — a CTE on SQLite, nothing on PostgreSQL. */
  readonly prefix: Readonly<SQL>
  /** The whole ` ORDER BY …` clause. */
  readonly orderBy: Readonly<SQL>
}

/** The CTE holding each matching record's BM25 score (SQLite). */
const RANK_CTE = '__word_rank'

/** `"k1" DESC, "k2" DESC` — ties newest first. Keys are validated column names. */
const tieBreak = (keys: readonly string[]): Readonly<SQL> =>
  sql.join(
    keys.map((key) => sql`${sql.identifier(key)} DESC`),
    sql`, `
  )

/**
 * SQLite: score every match ONCE in a materialized CTE — BM25 recomputes its
 * statistics per cursor, so a correlated `bm25()` per row would be quadratic —
 * and order each row by its score (lower is more relevant).
 */
const sqliteRelevance = (
  value: WordSearchValue,
  match: string,
  tieKeys: readonly string[]
): WordSearchRelevance => {
  const mirror = sql.identifier(mirrorOf(value))
  const rank = sql.identifier(RANK_CTE)
  return {
    prefix: sql`WITH ${rank} AS MATERIALIZED (
      SELECT ${sql.identifier(SQLITE_FTS_RECORD_ID_COLUMN)} AS rank_key, bm25(${mirror}) AS rank_score
      FROM ${mirror} WHERE ${mirror} MATCH ${match}
    ) `,
    orderBy: sql` ORDER BY (SELECT rank_score FROM ${rank} WHERE rank_key = CAST(${sql.identifier('id')} AS TEXT)) ASC, ${tieBreak(tieKeys)}`,
  }
}

/**
 * The relevance order of an unsorted word search — most relevant first (BM25
 * on SQLite, `ts_rank` on PostgreSQL), ties by `tieKeys` descending — or
 * `undefined` when the filter carries no word search with a word in it.
 */
export const wordSearchRelevance = (
  filter: { readonly and?: readonly unknown[] } | undefined,
  tieKeys: readonly string[]
): WordSearchRelevance | undefined => {
  const leaves = wordSearchLeavesOf(filter?.and ?? [])
  const [first] = leaves
  if (first === undefined) return undefined
  const terms = parseWordSearchQuery(first.value.query)
  if (terms.length === 0) return undefined
  const fields = [...new Set(leaves.map((leaf) => leaf.field))]
  fields.forEach(validateColumnName)
  if (isSqlite()) {
    if (!first.value.mirrored) return undefined
    return sqliteRelevance(first.value, toSqliteWordMatch(terms, fields), tieKeys)
  }
  const query = toPgWordTsQuery(terms)
  const ranks = fields.map(
    (field) => sql`ts_rank(${pgWordSearchVectorSql(field)}, to_tsquery('simple', ${query}))`
  )
  return {
    prefix: sql``,
    orderBy: sql` ORDER BY (${sql.join(ranks, sql` + `)}) DESC, ${tieBreak(tieKeys)}`,
  }
}
