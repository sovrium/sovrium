/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { evaluateRecordTriggerCondition } from './record-trigger-filters'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { App } from '@/domain/models/app'

/**
 * Inputs to the record-event trigger.
 *
 * `record` is the freshly created/updated/deleted row, surfaced to actions
 * via `{{trigger.data.record.X}}`. Specs reference the row's `id` to update
 * it back ({{trigger.data.record.id}}), and the row's other fields when
 * conditional logic depends on the new value.
 *
 * `previousRecord` is only meaningful for `update` events. It is used to
 * narrow update-event triggers via the `watchFields` config (only fire when
 * one of the listed fields actually changed). Pass undefined for create/
 * delete events.
 */
export interface TriggerRecordEventInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord?: Record<string, unknown>
  /**
   * Process env captured at the route boundary. Threaded through to
   * `executeAutomationRun` so action handlers can resolve `$env.VAR_NAME`
   * references and so secrets get redacted from run-history. Mirrors the
   * pattern used by `runWebhookAutomation` and `runManualAutomation` —
   * keeps this use case free of `process.env` reads inside the application
   * layer.
   */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** The user who triggered the record event (creator/updater). */
  readonly userId?: string
}

/**
 * Return true if at least one of `watchFields` differs between the
 * pre-update and post-update record. Used to suppress update-event triggers
 * whose `watchFields` config narrows them to specific columns.
 *
 * No `previousRecord` (e.g. create/delete events, or upstream skipped the
 * pre-fetch) means we cannot diff — falls open to "trigger fires" so
 * create/delete behaviour is unchanged.
 */
const watchFieldsChanged = (
  watchFields: readonly string[],
  record: Record<string, unknown>,
  previousRecord: Record<string, unknown> | undefined
): boolean => {
  if (previousRecord === undefined) return true
  return watchFields.some((field) => {
    const before = previousRecord[field]
    const after = record[field]
    // Compare with !== first (handles primitives) and fall back to
    // JSON.stringify for object-valued fields. The watchFields use case
    // here is single-line scalar fields (status, priority) so the JSON
    // path is a pragmatic safety net, not a deep-equality contract.
    if (before === after) return false
    return JSON.stringify(before) !== JSON.stringify(after)
  })
}

interface RecordEventMatchInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}

/**
 * Filter app.automations down to record-triggered automations whose trigger
 * config matches the (tableName, event) tuple AND, for `update` events,
 * passes `watchFields`/`condition` gates if configured. Disabled automations
 * are excluded so an admin can pause a misbehaving workflow without uninstall.
 */
const findMatchingRecordAutomations = (
  input: RecordEventMatchInput
): readonly NonNullable<App['automations']>[number][] => {
  const { app, tableName, event, record, previousRecord } = input
  return (app.automations ?? []).filter((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    if (!trigger.events.includes(event)) return false
    // watchFields narrows update events to specific columns. Create/delete
    // ignore watchFields per the schema convention (the column "doesn't
    // exist before/after" semantics are undefined).
    if (
      event === 'update' &&
      trigger.watchFields !== undefined &&
      !watchFieldsChanged(trigger.watchFields, record, previousRecord)
    ) {
      return false
    }
    // condition filters by record content. Evaluated against a context
    // exposing the new record at both `record.X` and `trigger.data.record.X`
    // so spec authors can pick the more readable variant.
    if (
      trigger.condition !== undefined &&
      !evaluateRecordTriggerCondition(trigger.condition, record)
    ) {
      return false
    }
    return true
  })
}

/**
 * Fire all record-triggered automations matching the given event.
 *
 * Matching applies, in order: (table, event) tuple, then `watchFields` for
 * update events (suppress when none of the listed columns changed), then
 * the optional `condition` group (evaluated against the post-mutation
 * record). See `findMatchingRecordAutomations` for the predicate details.
 *
 * Errors are absorbed at the boundary: a record-create endpoint returns 201
 * regardless of automation outcome (the run row records the failure).
 */
export const triggerRecordEventAutomations = (
  input: TriggerRecordEventInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements> =>
  Effect.gen(function* () {
    const { app, tableName, event, record, previousRecord, processEnv, userId } = input
    const matching = findMatchingRecordAutomations({
      app,
      tableName,
      event,
      record,
      previousRecord,
    })
    if (matching.length === 0) return

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData: { record } as unknown as TriggerData,
          userId,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:record-event] dispatch failure', cause)
      })
    )
  )
