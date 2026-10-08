/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dynamic-Record Repository Port.
 *
 * Backs the AI chat's READS (`chat-query.ts`, and the candidate rows the chat
 * write gate judges): counts, aggregates and listings against **arbitrary
 * user-defined tables** addressed by name. Which rows a call reaches is the
 * caller's to say: every read carries the chat read scope (live rows, the
 * caller's row-level read rule).
 *
 * It writes nothing. A chat create, update or delete goes through the records
 * API's one write road for its operation (`chat-write-gate.ts`), so it carries
 * the validation, activity entry, record automations and webhooks every other
 * write of the same record carries.
 *
 * Implementation lives in the infrastructure layer
 * (`dynamic-record-repository-live.ts`).
 */

import { Context, Data } from 'effect'
import type { LookupReadMask, QueryFilterNode } from './table-repository'
import type { Effect } from 'effect'

/**
 * The rows a caller may read, as a filter clause: the live rows (`deleted_at`
 * unset), narrowed by the caller's row-level read rule as the records read
 * gate projects it for SQL (`callerReadScope(...).clause`). ANDed onto a read
 * so it answers only the rows the records API would answer the same caller.
 */
export type DynamicRecordReadScope = QueryFilterNode

/**
 * A single-column equality filter narrowing a dynamic-record operation
 * (`column = value`). Mirrors the chat parsers' filter shape.
 */
export interface DynamicRecordFilter {
  readonly column: string
  readonly value: string
}

/** Database error for dynamic-record operations against user-defined tables. */
export class DynamicRecordError extends Data.TaggedError('DynamicRecordError')<{
  readonly cause: unknown
}> {}

/** Inputs for a `COUNT(*)` over a dynamic table. */
export interface DynamicRecordCountInput {
  readonly table: string
  readonly filter?: DynamicRecordFilter | undefined
  /**
   * Multi-condition AND filter (same shape as the list path). Backs the AI
   * structured `count_<table>` tool's `filters`.
   */
  readonly conditions?: ReadonlyArray<DynamicRecordCondition> | undefined
  /** The caller's row-level read rule, ANDed on (see {@link DynamicRecordReadScope}). */
  readonly readScope?: DynamicRecordReadScope | undefined
  /** Lookups to evaluate as empty for this reader, as the records list takes them. */
  readonly lookupMasks?: readonly LookupReadMask[] | undefined
}

/** Inputs for an `AVG`/`SUM` aggregate over a numeric column. */
export interface DynamicRecordAggregateInput {
  readonly table: string
  readonly fn: 'AVG' | 'SUM'
  readonly column: string
  readonly filter?: DynamicRecordFilter | undefined
  /** The caller's row-level read rule, ANDed on (see {@link DynamicRecordReadScope}). */
  readonly readScope?: DynamicRecordReadScope | undefined
  /** Lookups to evaluate as empty for this reader, as the records list takes them. */
  readonly lookupMasks?: readonly LookupReadMask[] | undefined
}

/** Inputs for a row-listing `SELECT` with an optional sort and a row cap. */
export interface DynamicRecordListInput {
  readonly table: string
  /**
   * Single-column equality filter. Retained for the existing chat-query path
   * (`chat-query.ts`) which builds a one-column filter.
   */
  readonly filter?: DynamicRecordFilter | undefined
  /**
   * Explicit column projection. When provided, the SELECT lists exactly these
   * columns (each rendered via `sql.identifier`); when omitted, `SELECT *`.
   * Backs the AI structured-query tool's `select`.
   */
  readonly columns?: ReadonlyArray<string> | undefined
  /**
   * Multi-condition AND filter. Each condition is `{ column, operator, value }`
   * where `operator` is the internal `generateSqlConditionFragment` vocabulary
   * (`equals`, `notEquals`, `greaterThan`, `contains`, `in`, `isNull`, …).
   * Backs the AI structured-query tool's `filters`.
   */
  readonly conditions?: ReadonlyArray<DynamicRecordCondition> | undefined
  /** Column to sort by; omitted when unsorted. */
  readonly sortColumn?: string | undefined
  /** Sort direction; defaults to `desc` when a `sortColumn` is set. */
  readonly sortDirection?: 'asc' | 'desc' | undefined
  /** Hard ceiling on returned rows. */
  readonly limit: number
  /** The caller's row-level read rule, ANDed on (see {@link DynamicRecordReadScope}). */
  readonly readScope?: DynamicRecordReadScope | undefined
  /** Lookups to evaluate as empty for this reader, as the records list takes them. */
  readonly lookupMasks?: readonly LookupReadMask[] | undefined
}

/**
 * A single AND-combined filter condition for the structured list path. The
 * `operator` is the internal `generateSqlConditionFragment` vocabulary; `value`
 * is bound as a query parameter (no value is ever interpolated as SQL).
 */
export interface DynamicRecordCondition {
  readonly column: string
  readonly operator: string
  readonly value?: unknown
}

/**
 * Dynamic-Record Repository Port.
 *
 * Every method targets a user-defined table by name and returns plain raw
 * result shapes. Reads only: a chat write goes through the records API's write
 * road for its operation.
 */
export class DynamicRecordRepository extends Context.Service<
  DynamicRecordRepository,
  {
    /** Run `SELECT COUNT(*)::int AS count`, optionally filtered. */
    readonly count: (input: DynamicRecordCountInput) => Effect.Effect<number, DynamicRecordError>
    /**
     * Run `SELECT AVG|SUM(col)::float AS value`, optionally filtered. Resolves
     * `undefined` when the aggregate yields SQL `NULL` (no matching rows).
     */
    readonly aggregate: (
      input: DynamicRecordAggregateInput
    ) => Effect.Effect<number | undefined, DynamicRecordError>
    /**
     * Run a row-listing `SELECT` with an optional column projection
     * (`columns`), an optional single-column equality `filter`, an optional
     * multi-condition AND filter (`conditions`), an optional `ORDER BY`
     * (`sortColumn` + `sortDirection`), and a `LIMIT`. All values are bound;
     * identifiers go through `sql.identifier`.
     */
    readonly list: (
      input: DynamicRecordListInput
    ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, DynamicRecordError>
  }
>()('DynamicRecordRepository') {}
