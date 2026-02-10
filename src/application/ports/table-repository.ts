/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from './user-session'
import type { SessionContextError, UniqueConstraintViolationError } from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * Query filter for record listing
 */
export interface QueryFilter {
  readonly and?: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
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
export class TableRepository extends Context.Tag('TableRepository')<
  TableRepository,
  {
    readonly listRecords: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly table?: { readonly permissions?: { readonly organizationScoped?: boolean } }
      readonly filter?: QueryFilter
      readonly includeDeleted?: boolean
      readonly sort?: string
      readonly app?: {
        readonly tables?: readonly {
          readonly name: string
          readonly fields: readonly unknown[]
        }[]
      }
    }) => Effect.Effect<readonly Record<string, unknown>[], SessionContextError>

    readonly listTrash: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
      readonly sort?: string
    }) => Effect.Effect<readonly Record<string, unknown>[], SessionContextError>

    readonly getRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      includeDeleted?: boolean
    ) => Effect.Effect<Record<string, unknown> | null, SessionContextError>

    readonly createRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      fields: Readonly<Record<string, unknown>>
    ) => Effect.Effect<
      Record<string, unknown>,
      SessionContextError | UniqueConstraintViolationError
    >

    readonly updateRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      params: {
        readonly fields: Readonly<Record<string, unknown>>
        readonly app?: App
      }
    ) => Effect.Effect<Record<string, unknown>, SessionContextError>

    readonly deleteRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string,
      app?: App
    ) => Effect.Effect<boolean, SessionContextError>

    readonly permanentlyDeleteRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string
    ) => Effect.Effect<boolean, SessionContextError>

    readonly restoreRecord: (
      session: Readonly<UserSession>,
      tableName: string,
      recordId: string
    ) => Effect.Effect<Record<string, unknown> | null, SessionContextError>

    readonly computeAggregations: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly filter?: QueryFilter
      readonly includeDeleted?: boolean
      readonly aggregate: AggregateQuery
    }) => Effect.Effect<AggregationResult, SessionContextError>
  }
>() {}
