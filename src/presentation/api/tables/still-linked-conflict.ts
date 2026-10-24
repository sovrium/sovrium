/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, type Schema } from 'effect'
import { findConstraintViolation, findStillReferencingTable } from '@/domain/errors/driver-failure'
import { findForeignKeyCandidates } from '@/domain/models/app/tables/relationship-foreign-key'
import { conflict } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffect, runOnRequest } from '@/presentation/api/runtime/run-effect'
import { handleRouteError } from './error-handlers'
import { callerReadsTable } from './table-read-gate'
import type { App, Table } from '@/domain/models/app'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/** Referential actions that let the delete through instead of refusing it. */
const YIELDING_ON_DELETE: ReadonlySet<string> = new Set([
  'cascade',
  'set-null',
  'set null',
  'set-default',
  'set default',
])

/** Whether `table` holds a key to `deletedTable` that refuses the delete. */
const holdsRefusingKeyTo = (table: Table, deletedTable: string): boolean =>
  findForeignKeyCandidates(table, deletedTable).some((name) => {
    const field = table.fields.find((candidate) => candidate.name === name) as
      { readonly onDelete?: unknown } | undefined
    const action = typeof field?.onDelete === 'string' ? field.onDelete.toLowerCase() : undefined
    return action === undefined || !YIELDING_ON_DELETE.has(action)
  })

/**
 * The table whose rows still link to the record, or `undefined` when it cannot
 * be told: the driver's own word when it names one of the app's tables
 * (PostgreSQL), otherwise the one table whose key to `deletedTable` refuses a
 * delete (SQLite names none). Several such tables name none of them, rather
 * than guess.
 */
export const stillLinkingTable = (
  app: App,
  deletedTable: string,
  error: unknown
): Table | undefined => {
  const tables = app.tables ?? []
  const named = findStillReferencingTable(error)
  const byName = tables.find((table) => table.name === named)
  if (byName !== undefined) return byName
  const candidates = tables.filter((table) => holdsRefusingKeyTo(table, deletedTable))
  return candidates.length === 1 ? candidates[0] : undefined
}

/**
 * The message of a delete refused because other rows still link to the
 * record. The linking table is named only when `reads` admits the caller to
 * it; anyone else is told the same thing without the name.
 */
export const stillLinkedMessage = async (
  input: { readonly app: App; readonly deletedTable: string; readonly error: unknown },
  reads: (table: Table) => Promise<boolean>
): Promise<string> => {
  const linking = stillLinkingTable(input.app, input.deletedTable, input.error)
  const named = linking !== undefined && (await reads(linking)) ? linking.name : undefined
  const source = named === undefined ? 'other records' : `records of the "${named}" table`
  return `This record is still linked from ${source}. Unlink or delete them first, then delete it again.`
}

/**
 * The `409` of a delete refused because other rows still link to the record,
 * or `undefined` for any other failure, which the caller answers as before.
 */
export async function stillLinkedConflict(
  c: Context,
  app: App,
  error: unknown
): Promise<Response | undefined> {
  if (findConstraintViolation(error) !== 'still-referenced') return undefined
  const input = { app, deletedTable: getTableContext(c).tableName, error }
  return conflict(c, await stillLinkedMessage(input, (table) => callerReadsTable(c, app, table)))
}

/**
 * Run a delete program and answer it: its success through `schema`, a record
 * other rows still link to as {@link stillLinkedConflict}'s `409`, and every
 * other failure through the sanitized route error.
 */
export async function answerDeleteProgram<A, E>(
  c: Context,
  app: App,
  program: Effect.Effect<A, E, DomainServices>,
  schema: Schema.Top
): Promise<Response> {
  const outcome = await runOnRequest(c, program)
  if (outcome._tag === 'Success') return runEffect(c, Effect.succeed(outcome.success), schema)
  return (
    (await stillLinkedConflict(c, app, outcome.failure)) ?? handleRouteError(c, outcome.failure)
  )
}
