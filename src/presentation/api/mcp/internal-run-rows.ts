/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A run row as the raw `system.automation_runs` tools answer it: its trigger
 * data masked as the admin run read masks it (`run-list-body.ts`), a credential
 * header and every value held under a write-only name. The stored copy is left
 * whole, because a run that resumes reads it back.
 */

import { Effect } from 'effect'
import { withWriteOnlyValuesMasked } from '@/application/use-cases/automations/run/write-only-values'
import { redactRunTriggerData } from '@/domain/models/app/automations/trigger/webhook-credential-headers-service'
import { InternalTableRegistry } from '@/domain/models/app/tables/internal-tables'
import type { McpInternalsRepository } from '@/application/ports/repositories/mcp/mcp-internals-repository'
import type { App } from '@/domain/models/app'
import type { InternalTableEntry } from '@/domain/models/app/tables/internal-tables'

export type RunRow = Readonly<Record<string, unknown>>

/** Whether this registry entry is the table of run rows. */
export const isRunsTable = (entry: InternalTableEntry): boolean =>
  entry.schema === 'system' && entry.name === 'automation_runs'

const DEFINITIONS_TABLE = InternalTableRegistry.find(
  (entry) => entry.schema === 'system' && entry.name === 'automation_definitions'
)

/** The name of each automation the rows belong to, keyed by definition id. */
const definitionNamesOf = (
  repository: McpInternalsRepository['Service'],
  rows: ReadonlyArray<RunRow>
) =>
  Effect.gen(function* () {
    if (DEFINITIONS_TABLE === undefined) return new Map<string, unknown>()
    const ids = [...new Set(rows.map((row) => String(row['automation_id'])))]
    const definitions = yield* Effect.forEach(ids, (id) =>
      repository.readRow(DEFINITIONS_TABLE, id)
    )
    return new Map<string, unknown>(
      definitions.map((definition, index) => [String(ids[index]), definition?.['name']])
    )
  })

/**
 * JSON text as its value. Text that does not parse cannot be masked, so it is
 * not answered at all.
 */
const parsedOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * Trigger data with the masks applied, in the shape it came in: SQLite stores it
 * as JSON text, PostgreSQL's driver hands back the value.
 */
const maskedTriggerData = (app: App, automationName: unknown, stored: unknown): unknown => {
  const mask = (data: unknown): unknown =>
    withWriteOnlyValuesMasked(
      app,
      redactRunTriggerData(
        data,
        app.automations?.find((automation) => automation.name === automationName)
      )
    )
  if (typeof stored !== 'string') return mask(stored)
  const parsed = parsedOrNull(stored)
  return parsed === null ? null : JSON.stringify(mask(parsed))
}

/** The rows of one answer, each one's trigger data masked by its own automation. */
export const answeredRunRows = Effect.fn('mcp.answered-run-rows')(function* (
  repository: McpInternalsRepository['Service'],
  app: App,
  rows: ReadonlyArray<RunRow>
) {
  const names = yield* definitionNamesOf(repository, rows)
  return rows.map((row) => ({
    ...row,
    trigger_data: maskedTriggerData(
      app,
      names.get(String(row['automation_id'])),
      row['trigger_data']
    ),
  }))
})
