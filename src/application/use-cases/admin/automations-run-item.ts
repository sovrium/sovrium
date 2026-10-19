/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin run item: one run row of the runs history, list and detail alike,
 * projected onto the public run shape plus the facts a history reads at a
 * glance — the record the run concerns, and how far it got.
 */

import { withWriteOnlyValuesMasked } from '@/application/use-cases/automations/run/write-only-values'
import { formatElapsedDuration } from '@/domain/kernel/format/duration-format'
import { runStatusSchema, type RunStatus } from '@/domain/models/api/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { entityLabelFor } from '@/domain/models/app/auth/readable-name-service'
import { redactRunTriggerData } from '@/domain/models/app/automations/trigger/webhook-credential-headers-service'
import {
  runRecordRefOf,
  runTriggerOf,
} from '@/domain/models/app/automations/trigger-entries-service'
import { runRecordLabel, runTriggerLabel } from './automations-run-labels'
import type { AdminAutomationRunRow } from '@/application/ports/repositories/automations/admin-automations-repository'
import type { ConsoleLanguage } from '@/application/use-cases/admin/operator-language'
import type { AutomationRunAdminItem } from '@/domain/models/api/admin/automations'
import type { App } from '@/domain/models/app'

/**
 * Convert a database timestamp (Date or string) to canonical ISO 8601 UTC.
 * Postgres returns `Date`, SQLite returns either Date (when mode: timestamp_ms)
 * or string depending on the driver. We normalize for the response shape.
 */
export function toIso(value: Readonly<Date> | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * Best-effort coercion of a string-status to the canonical RunStatus enum.
 * The DB stores arbitrary text on `automation_runs.status` (default 'pending');
 * malformed values fall back to 'pending' so the response always validates.
 */
function coerceStatus(raw: unknown): RunStatus {
  const parsed = decodeSafe(runStatusSchema)(raw)
  return parsed.success ? parsed.data : 'pending'
}

/**
 * How far a run got, as one reading per console language. The console declares
 * English and French; the phrase lives here rather than in a translation table
 * because the reading is built by the server, for a console that may be mounted
 * on an app declaring no languages at all (whose author overrides must not
 * rename the operator's chrome).
 */
const RUN_STEPS_PHRASE: Readonly<Record<ConsoleLanguage, string>> = {
  en: '{ran} of {count}',
  fr: '{ran} sur {count}',
}

/**
 * `stepsLabel`: `2 of 3` (`2 sur 3`), or the steps that ran alone (`2`) once the
 * automation is no longer declared and its length cannot be known.
 */
function runStepsLabel(
  stepsRun: number,
  stepCount: number | null,
  language: ConsoleLanguage
): string {
  if (stepCount === null) return String(stepsRun)
  return RUN_STEPS_PHRASE[language]
    .replace('{ran}', String(stepsRun))
    .replace('{count}', String(stepCount))
}

/**
 * Build a canonical admin run item from a joined DB row.
 *
 * The public `runSchema` requires every field — including `startedAt`. For runs
 * that never reached the scheduler (rare race in tests where the webhook
 * returned before the engine wrote `started_at`), we fall back to `createdAt` so
 * the schema does not reject the row.
 *
 * `stepsRun` is the count of the run's recorded step rows that ran (a
 * `skipped` row never did), supplied by the caller (one grouped read for a
 * page). `stepCount` is the declared
 * automation's top-level action count, null once it is no longer declared. The
 * record reference is read from the RAW trigger payload — a record id is not a
 * secret — before the payload is redacted and masked for display. `stepsLabel`
 * reads the two figures as one phrase in the operator's console `language`.
 */
export function buildAdminRunItem(
  app: App,
  row: AdminAutomationRunRow,
  stepsRun: number,
  language: ConsoleLanguage
): AutomationRunAdminItem {
  // The run's trigger (`runTriggerOf`) and hidden credential headers, read off the live config.
  const def = (app.automations ?? []).find((a) => a.name === row.automationName)
  const startedAtIso = toIso(row.startedAt) ?? toIso(row.createdAt) ?? new Date().toISOString()
  // The erasure marker the public run reads carry, present only when set.
  const valuesErasedAt = toIso(row.valuesErasedAt)
  const stepCount = def === undefined ? null : def.actions.length
  const durationLabel = formatElapsedDuration(row.durationMs, language)
  return {
    id: row.id,
    automationName: row.automationName,
    // What a person reads: the declared label, else the name made readable —
    // also for an automation no longer declared, from its stored name.
    automationLabel: entityLabelFor(def ?? { name: row.automationName }),
    status: coerceStatus(row.status),
    ...runTriggerOf(def, row.triggerName),
    triggerData: withWriteOnlyValuesMasked(app, redactRunTriggerData(row.triggerData ?? null, def)),
    startedAt: startedAtIso,
    completedAt: toIso(row.completedAt),
    durationMs: row.durationMs,
    // The elapsed-time readout a `duration` column prints, absent while running.
    ...(durationLabel === undefined ? {} : { durationLabel }),
    attempt: 1,
    error: row.error,
    ...(valuesErasedAt === null ? {} : { valuesErasedAt }),
    ...runRecordRefOf(def, row.triggerName, row.triggerData),
    recordLabel: runRecordLabel(app, def, row),
    triggerLabel: runTriggerLabel(app, def, row, language),
    stepsRun,
    stepCount,
    stepsLabel: runStepsLabel(stepsRun, stepCount, language),
    _admin: {
      lastModifiedBy: null,
      deletedAt: null,
    },
  }
}
