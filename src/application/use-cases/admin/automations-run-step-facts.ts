/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The facts of one persisted step the admin run detail reads beside its
 * input and output: the entries it logged, and when it ran.
 */

import { stepLogEntrySchema } from '@/domain/models/api/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { stepConnectionOf } from '@/domain/models/app/connections/connection-usage-service'
import type { AdminRunStep } from '@/domain/models/api/admin/automations'
import type { App } from '@/domain/models/app'

const decodeStepLogEntry = decodeSafe(stepLogEntrySchema)

/**
 * Read the persisted `logs` column as the step's log entries. Always an array:
 * an absent or non-array column is a step that logged nothing, and an entry
 * the engine would never write (unknown level, missing message, a bare value)
 * is DROPPED one by one, so one corrupt entry cannot 500 a run.
 */
export function readStepLogs(logs: unknown): AdminRunStep['logs'] {
  if (!Array.isArray(logs)) return []
  return logs.flatMap((entry: unknown) => {
    const decoded = decodeStepLogEntry(entry)
    return decoded.success ? [{ level: decoded.data.level, message: decoded.data.message }] : []
  })
}

/** The persisted step columns that say when it ran. */
export interface StepTimingColumns {
  readonly startedAt?: string | null
  readonly completedAt?: string | null
  readonly durationMs?: number | null
}

/** When the step ran, so a timeline can say which step took the time; `null` for a step that never did. */
export const stepTimingOf = (step: StepTimingColumns) => ({
  startedAt: step.startedAt ?? null,
  completedAt: step.completedAt ?? null,
  durationMs: step.durationMs ?? null,
})

/** A run-detail step, as far as naming the one a failed run stopped on goes. */
interface FailedStepCandidate {
  readonly index: number
  readonly name: string
  readonly label?: string | null | undefined
  readonly status: string
}

/**
 * The top-level step a failed run stopped on — its index, its position counted
 * from 1 and its label — with the connection it reaches its provider through,
 * so the run page can lead to that one connection. `null` for a run that did
 * not fail, and for a failed run no step of which failed.
 */
export function failedStepOf(
  app: App,
  automationName: string,
  runStatus: string | null,
  steps: readonly FailedStepCandidate[]
): {
  readonly index: number
  readonly number: number
  readonly label: string
  readonly connection?: string
  readonly connectionLabel?: string
} | null {
  const position = runStatus === 'failed' ? steps.findIndex((step) => step.status === 'failed') : -1
  const failed = steps[position]
  if (failed === undefined) return null
  return {
    index: failed.index,
    number: position + 1,
    label: failed.label ?? failed.name,
    ...stepConnectionOf(app.automations, app.connections, automationName, failed.name),
  }
}
