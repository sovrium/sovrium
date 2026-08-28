/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from '@/application/ports/models/user-session'
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
 * Nestable filter node (GAP-3 composite row-level predicates): a leaf, an
 * `and` group, or an `or` group. The SQL WHERE builder walks this tree,
 * emitting `( … AND … )` / `( … OR … )` groups. Single-clause filters use a
 * bare leaf — fully backward compatible with the pre-GAP-3 flat shape.
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
  readonly sum?: Record<string, number>
  readonly avg?: Record<string, number>
  readonly min?: Record<string, number>
  readonly max?: Record<string, number>
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
      readonly includeDeleted?: boolean
      readonly sort?: string
      readonly app?: {
        readonly tables?: readonly {
          readonly name: string
          readonly fields: readonly unknown[]
        }[]
      }
    }) => Effect.Effect<readonly Record<string, unknown>[], DatabaseError>

    readonly listTrash: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
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
