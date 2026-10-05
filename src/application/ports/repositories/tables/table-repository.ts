/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  ForeignKeyViolationError,
  DatabaseError,
  UniqueConstraintViolationError,
} from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * A single filter leaf clause (`field <operator> value`).
 */
export interface QueryFilterLeaf {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/**
 * Nestable filter node ([internal ref] composite row-level predicates): a leaf, an
 * `and` group, or an `or` group. The SQL WHERE builder walks this tree,
 * emitting `( … AND … )` / `( … OR … )` groups. Single-clause filters use a
 * bare leaf — fully backward compatible with the pre-[internal ref] flat shape.
 */
export type QueryFilterNode =
  | QueryFilterLeaf
  | { readonly and: readonly QueryFilterNode[] }
  | { readonly or: readonly QueryFilterNode[] }

/**
 * Query filter for record listing. Each top-level `and` entry may be a flat
 * leaf clause OR a nested AND/OR group (composite row-level predicates).
 */
export interface QueryFilter {
  readonly and?: readonly QueryFilterNode[]
}

/**
 * A lookup a list must evaluate as EMPTY for every row whose linked record the
 * reader may not read — so a filter, a sort or an aggregate naming it never
 * steers on a value the reader may not see.
 *
 * `readable` is the related table's row-level read rule projected for this
 * reader; `undefined` means no related row is readable. `link` says where the
 * row's keys live: a `column` on the row (many-to-one, one-to-one), the
 * junction of a many-to-many link, or — `reverse` — the related rows' `column`
 * pointing back at the row. The last two recompute the lookup from the readable
 * linked rows (and the lookup's own `filters`).
 *
 * A lookup of a lookup takes the `chain` link: every record it reads through,
 * one key column after the next, each with its table's rule projected for this
 * reader (`undefined` where the table carries none). The value is kept on a row
 * whose every hop is readable and evaluated as empty elsewhere; the mask's own
 * `readable` is not read. When the chain ends on a copied LIST, its `list` names
 * that many-to-many or reverse link: the value is recomputed through every hop
 * from the listed rows that pass the list table's rule (and the lookup's own
 * `filters`), so it keeps the names the reader may read and none other.
 */
export interface LookupReadMask {
  readonly lookup: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly readable: QueryFilterNode | undefined
  readonly link:
    | { readonly kind: 'column'; readonly column: string }
    | { readonly kind: 'junction'; readonly filters?: QueryFilterNode }
    | { readonly kind: 'reverse'; readonly column: string; readonly filters?: QueryFilterNode }
    | {
        readonly kind: 'chain'
        readonly hops: readonly LookupReadHop[]
        readonly list?: LookupReadList
      }
}

/**
 * The list a lookup of a lookup copies at the end of its chain: the
 * many-to-many link (`junction`) of `sourceTable` to `relatedTable`, or the
 * back-link `column` of `relatedTable` (`reverse`), its copied `relatedField`,
 * the related table's rule projected for the reader (`undefined` where it
 * carries none) and the lookup's own `filters`.
 */
export interface LookupReadList {
  readonly kind: 'junction' | 'reverse'
  readonly sourceTable: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly column?: string
  readonly readable: QueryFilterNode | undefined
  readonly filters?: QueryFilterNode
}

/**
 * One record a lookup of a lookup reads through: the key `column` of the row
 * before it (the listed row for the first hop), the `relatedTable` that key
 * names, and that table's rule projected for the reader.
 */
export interface LookupReadHop {
  readonly column: string
  readonly relatedTable: string
  readonly readable: QueryFilterNode | undefined
}

/**
 * Aggregation query configuration
 */
export interface AggregateQuery {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/**
 * Aggregation result from database
 */
export interface AggregationResult {
  readonly count?: string
  /** A number, or `null` over no values. */
  readonly sum?: Record<string, number | null>
  /** A number, or `null` over no values. */
  readonly avg?: Record<string, number | null>
  /** A number, a date as its ISO string, or `null` over no values. */
  readonly min?: Record<string, number | string | null>
  /** A number, a date as its ISO string, or `null` over no values. */
  readonly max?: Record<string, number | string | null>
}

/**
 * Table Repository port for CRUD operations
 *
 * Defines the contract between the Application layer and database infrastructure.
 * Live implementation delegates to table-queries infrastructure functions.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const repo = yield* TableRepository
 *   const records = yield* repo.listRecords({ session, tableName: 'users' })
 * })
 * ```
 */
export class TableRepository extends Context.Service<
  TableRepository,
  {
    readonly listRecords: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
      /**
       * Lookups to evaluate as empty on the rows whose linked record the reader
       * may not read, wherever the query names them (filter, sort, aggregate).
       */
      readonly lookupMasks?: readonly LookupReadMask[]
      readonly includeDeleted?: boolean
      readonly sort?: string
      /**
       * Page size and start offset, applied as SQL `LIMIT` / `OFFSET`.
       *
       * Both are optional and purely ADDITIVE: a caller passing neither emits
       * byte-identical SQL to what this port has always emitted, which is what
       * lets pagination push down without auditing every existing consumer.
       *
       * A caller that pages MUST also supply a TOTAL ordering — the `record`
       * `list` operator appends an implicit `id ASC` for exactly this reason.
       * An `OFFSET` over a relation with ties may hand the same row back on two
       * consecutive pages and skip another entirely, and no error is raised
       * when it does.
       */
      readonly limit?: number
      readonly offset?: number
      /**
       * Projected select list. Omit for `SELECT *`, which is what every caller
       * without a field selection wants — the CSV export and the MCP tool call
       * both list with no projection and expect every column back.
       *
       * The names are CANDIDATES rather than a promise: the implementation
       * intersects them with the relation's live catalog before emitting
       * anything, so an optional system column a given table does not have is
       * quietly dropped instead of becoming a hard error.
       */
      readonly columns?: readonly string[]
      readonly app?: {
        readonly tables?: readonly {
          readonly name: string
          readonly fields: readonly unknown[]
        }[]
      }
      /**
       * The declared primary key of `tableName`, used ONLY to pick the default
       * sort key when the caller supplied no `sort`.
       *
       * It is here rather than being read back out of `app` because a table
       * declaring a composite key over fields other than `id` HAS NO `id`
       * COLUMN — the DDL generator suppresses the automatic one — so ordering
       * an unsorted list by `id` names a column that does not exist. On
       * PostgreSQL that is SQLSTATE 42703, surfaced as a 400 blaming the caller
       * for a sort they never sent; on SQLite the quoted identifier degrades to
       * a string literal and the read silently succeeds unordered.
       *
       * Separate from `app` deliberately: `app` also drives single-select
       * option ordering, so passing it purely to reach the primary key would
       * change how an EXPLICIT sort is emitted too.
       */
      readonly primaryKey?: {
        readonly type?: string
        readonly fields?: readonly string[]
      }
    }) => Effect.Effect<readonly Record<string, unknown>[], DatabaseError>

    readonly listTrash: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
      /** Lookups to evaluate as empty for this reader, as `listRecords` takes them. */
      readonly lookupMasks?: readonly LookupReadMask[]
      readonly sort?: string
    }) => Effect.Effect<readonly Record<string, unknown>[], DatabaseError>

    readonly getRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      includeDeleted?: boolean
    ) => Effect.Effect<Record<string, unknown> | null, DatabaseError>

    readonly createRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      fields: Readonly<Record<string, unknown>>
    ) => Effect.Effect<
      Record<string, unknown>,
      DatabaseError | UniqueConstraintViolationError | ForeignKeyViolationError
    >

    readonly updateRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      params: {
        readonly fields: Readonly<Record<string, unknown>>
        readonly app?: App
      }
    ) => Effect.Effect<Record<string, unknown>, DatabaseError>

    readonly deleteRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      app?: App
    ) => Effect.Effect<
      { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
      DatabaseError
    >

    readonly permanentlyDeleteRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string
    ) => Effect.Effect<boolean, DatabaseError>

    readonly restoreRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string
    ) => Effect.Effect<Record<string, unknown> | null, DatabaseError>

    readonly computeAggregations: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
      /**
       * Lookups to evaluate as empty on the rows whose linked record the reader
       * may not read, wherever the query names them (filter, sort, aggregate).
       */
      readonly lookupMasks?: readonly LookupReadMask[]
      readonly includeDeleted?: boolean
      readonly aggregate: AggregateQuery
    }) => Effect.Effect<AggregationResult, DatabaseError>

    /**
     * [internal ref]: write the junction rows for a record's `many-to-many` fields.
     * Each link writes the source→related row and, when `hasReciprocal`, the
     * mirror row so the reciprocal side sees the link. Idempotent.
     */
    readonly linkManyToMany: (input: {
      readonly sourceTable: string
      readonly sourceId: string | number
      readonly links: readonly {
        readonly relatedTable: string
        readonly relatedIds: readonly (string | number)[]
        readonly hasReciprocal: boolean
      }[]
    }) => Effect.Effect<void, DatabaseError>

    /**
     * Remove named junction rows of a record's `many-to-many` fields — the
     * inverse of {@link linkManyToMany}, mirror row included. A pair that is
     * not linked is a no-op. Used when a field is cleared.
     */
    readonly unlinkManyToMany: (input: {
      readonly sourceTable: string
      readonly sourceId: string | number
      readonly links: readonly {
        readonly relatedTable: string
        readonly relatedIds: readonly (string | number)[]
        readonly hasReciprocal: boolean
      }[]
    }) => Effect.Effect<void, DatabaseError>

    /**
     * [internal ref]: resolve `many-to-many` field values from junction tables for a
     * set of source records. Returns `recordId -> fieldName -> relatedIds`.
     */
    readonly readManyToMany: (input: {
      readonly sourceTable: string
      readonly sourceIds: readonly (string | number)[]
      readonly fields: readonly { readonly fieldName: string; readonly relatedTable: string }[]
    }) => Effect.Effect<Record<string, Record<string, readonly (string | number)[]>>, DatabaseError>

    /**
     * Resolve the human label behind a relationship's stored key, for every
     * related table a listed page of records points at.
     *
     * A relationship column holds an identifier; a field declaring
     * `displayField` has named the column that identifies the related row to a
     * person. This reads that column WITHOUT touching the stored key, so
     * filters, editors and the write path keep seeing the identifier they store
     * while a read surface can show the name.
     *
     * Returns `"<relatedTable>.<displayField>" -> id -> label`. A referenced row
     * that no longer exists, or whose display column is empty, has no entry.
     */
    readonly readRelatedLabels: (
      requests: readonly {
        readonly relatedTable: string
        readonly displayField: string
        readonly ids: readonly (string | number)[]
      }[]
    ) => Effect.Effect<Record<string, Record<string, string>>, DatabaseError>
  }
>()('TableRepository') {}
