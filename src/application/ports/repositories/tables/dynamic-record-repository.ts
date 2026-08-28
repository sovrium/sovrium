/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dynamic-Record Repository Port.
 *
 * Backs the AI chat read-query and record-mutation flows
 * (`chat-query.ts` / `chat-mutation.ts`) — the lone codebase cluster that ran
 * raw `db.execute(sql`…`)` DML directly from the presentation layer. This port
 * relocates that SQL behind the application boundary with **byte-identical
 * behavior**: the live implementation runs the exact same parameterised SQL the
 * chat routes ran before (`COUNT(*)::int AS count`, `AVG/SUM(…)::float AS
 * value`, `INSERT … RETURNING id`, `… RETURNING id`), against
 * **arbitrary user-defined tables** addressed by name.
 *
 * It deliberately does NOT route through `table-queries/crud/` — those add
 * activity-logging, authorship stamping, soft-delete filtering, and cascade
 * behavior the chat routes intentionally omit. The behavior contract is
 * "exactly what the chat routes do today, just relocated."
 *
 * Implementation lives in the infrastructure layer
 * (`dynamic-record-repository-live.ts`).
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

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
}

/** Inputs for an `AVG`/`SUM` aggregate over a numeric column. */
export interface DynamicRecordAggregateInput {
  readonly table: string
  readonly fn: 'AVG' | 'SUM'
  readonly column: string
  readonly filter?: DynamicRecordFilter | undefined
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

/** Inputs for inserting one row; an empty payload uses `DEFAULT VALUES`. */
export interface DynamicRecordInsertInput {
  readonly table: string
  readonly data: Readonly<Record<string, unknown>>
}

/** Inputs for updating a single row by its `id`. */
export interface DynamicRecordUpdateByIdInput {
  readonly table: string
  readonly recordId: number
  readonly data: Readonly<Record<string, unknown>>
}

/** Inputs for updating every row of a table. */
export interface DynamicRecordUpdateAllInput {
  readonly table: string
  readonly data: Readonly<Record<string, unknown>>
}

/** Inputs for a hard delete, optionally narrowed by an equality filter. */
export interface DynamicRecordDeleteInput {
  readonly table: string
  readonly filter?: DynamicRecordFilter | undefined
}

/**
 * Dynamic-Record Repository Port.
 *
 * Every method targets a user-defined table by name and returns plain raw
 * result shapes — no authorship, no soft-delete, no cascade.
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
    /** Insert one row; resolves the generated `id` (`RETURNING id`). */
    readonly insert: (
      input: DynamicRecordInsertInput
    ) => Effect.Effect<number | string, DynamicRecordError>
    /** Update a single row by `id`; resolves `true` when a row was affected. */
    readonly updateById: (
      input: DynamicRecordUpdateByIdInput
    ) => Effect.Effect<boolean, DynamicRecordError>
    /** Update every row; resolves the affected record ids (`RETURNING id`). */
    readonly updateAll: (
      input: DynamicRecordUpdateAllInput
    ) => Effect.Effect<ReadonlyArray<number>, DynamicRecordError>
    /** Hard-delete rows, optionally filtered; resolves the deleted ids. */
    readonly delete: (
      input: DynamicRecordDeleteInput
    ) => Effect.Effect<ReadonlyArray<number>, DynamicRecordError>
  }
>()('DynamicRecordRepository') {}
