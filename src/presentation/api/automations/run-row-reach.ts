/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a run's reader reads every row of a table a step read — the row
 * half of the judgement in `run-step-reach.ts`.
 */

import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { AppTable, Reader } from './run-record-reach'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Log a read the judgement could not make; the caller then fails closed. */
const unreadable =
  (what: string, tableName: string) =>
  (cause: unknown): undefined => {
    logError(`[automations] run step reach: ${what} unreadable; showing the step masked`, cause, {
      tableSlug: tableName,
    })
    return undefined
  }

/**
 * True when nothing narrows the signed-in reader on `table`: no row-level rule,
 * and a records list admitting her every row (`readerRowsOf`) — not only the
 * rows a grant admits, nor none. A scope or admission that cannot be read
 * counts as narrowing her (fail closed).
 */
export const readsEveryRow = async (
  c: Context,
  app: App,
  table: AppTable,
  reader: Reader & { readonly userId: string }
): Promise<boolean> => {
  const session = buildSyntheticSession(reader.userId)
  const scope = await runDomainPromise(c, callerReadScope(app, session, table.name)).catch(
    unreadable('row-level scope', table.name)
  )
  if (scope === undefined || scope.clause !== undefined) return false
  const rows = await runDomainPromise(
    c,
    readerRowsOf(app, table.name, { session, role: reader.role, groups: reader.groups })
  ).catch(unreadable('row admission', table.name))
  return rows?.admission.kind === 'every-row'
}
