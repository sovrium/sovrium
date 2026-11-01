/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { DatabaseError } from '@/domain/errors'
import { passingFilterRefusal } from '@/infrastructure/database/sql/db-effect'
import { buildWhereClause, type FilterNode } from './aggregation-helpers'
import type { UncompilableFilterOperatorError } from '@/domain/errors/uncompilable-filter-operator-error'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { SQL } from 'drizzle-orm'

/**
 * A record read's `WHERE` clause as an Effect. The filter compilers are
 * synchronous and refuse an operator they do not know by throwing; built here,
 * that refusal is a typed failure the caller passes up as itself — a 400 at
 * the API — never a defect, and never folded into a database error.
 */
export const whereClauseOf = (
  dialect: DatabaseDialect,
  tableName: string,
  scope: {
    readonly hasDeletedAt: boolean
    readonly includeDeleted: boolean | undefined
    readonly filter: { readonly and?: readonly FilterNode[] } | undefined
  }
): Effect.Effect<Readonly<SQL>, DatabaseError | UncompilableFilterOperatorError> =>
  Effect.try({
    try: () => buildWhereClause(dialect, scope.hasDeletedAt, scope.includeDeleted, scope.filter),
    catch: passingFilterRefusal(
      (cause) => new DatabaseError(`Failed to build the filter of ${tableName}`, cause)
    ),
  })
