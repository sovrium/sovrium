/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { serializeDriverRow } from '@/application/use-cases/tables/record-transformer'
import {
  relationshipFieldNames,
  withStringRecordId,
  withStringRelationshipValues,
} from '@/domain/models/app/tables/record-id-service'
import { logError } from '@/infrastructure/logging/logger'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import { withoutAdminOnlyTriggerFields } from './record-trigger-data-permissions'
import { anyRecordEntryMayMatch, findMatchingRecordAutomations } from './record-trigger-filters'
import { buildRecordTriggerData } from './record-trigger-hydration'
import { identifyRequesterIfAny } from './requester-identity'
import type { TriggerData, TriggerRequester } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { CommentRepository } from '@/application/ports/repositories/comment-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'

/**
 * Inputs to the record-event trigger.
 *
 * `record` is the freshly created/updated/deleted row, surfaced to actions
 * via `{{trigger.data.record.X}}`. Specs reference the row's `id` to update
 * it back ({{trigger.data.record.id}}), and the row's other fields when
 * conditional logic depends on the new value.
 *
 * `previousRecord` is only meaningful for `update` events. It narrows
 * update-event triggers via the `watchFields` config (only fire when one of
 * the listed fields actually changed), is readable in the trigger's own
 * `condition`, and reaches every run as `{{trigger.data.previousRecord.X}}`.
 * Pass undefined for create/delete events.
 */
export interface TriggerRecordEventInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete' | 'restore'
  readonly record: Record<string, unknown>
  readonly previousRecord?: Record<string, unknown>
  /**
   * Process env captured at the route boundary, so action handlers resolve `$env.VAR_NAME`
   * and secrets are redacted from run-history (no `process.env` read in this layer).
   */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** The user who triggered the record event (creator/updater). */
  readonly userId?: string
  /** Who made the write, as `{{trigger.user}}`: absent for a guest's write. */
  readonly requester?: TriggerRequester
  /** `requester` completed with email and name; a batch shares one lookup per person. */
  readonly identify?: Effect.Effect<TriggerRequester | undefined, never, CommentRepository>
  /**
   * How many automation writes separate this event from a person's write — 0
   * (the default) for a records API write, N+1 for a write by a step of an
   * N-deep run. Carried into the runs it starts.
   */
  readonly depth?: number
}

/**
 * The record and the pre-update row as an action reads them. Both carry the id
 * as the records API names it — a string on every event, where the delete road
 * hands over a driver row whose serial id is a number — and the raw pre-update
 * row has its dates read as the record's own values are:
 * `{{trigger.data.previousRecord.<date>}}` reads the day on both engines, not a
 * PostgreSQL `Date`.
 */
const readableRecords = (
  input: TriggerRecordEventInput
): {
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>> | undefined
} => {
  // A relationship value is the related record's id, and reads as a string too.
  const links = relationshipFieldNames(input.app.tables?.find((t) => t.name === input.tableName))
  return {
    record: withStringRelationshipValues(withStringRecordId(input.record), links),
    previousRecord:
      input.previousRecord === undefined
        ? undefined
        : withStringRelationshipValues(
            withStringRecordId(serializeDriverRow(input.previousRecord, input)),
            links
          ),
  }
}

/**
 * Fire every record-triggered automation matching the event: the (table, event)
 * tuple, then `watchFields` on an update, then the optional `condition` group
 * against the expanded post-mutation record (and the pre-mutation one on an
 * update). Each run receives those rows without their admin-only fields.
 * Errors are absorbed at the boundary: the record endpoint answers regardless of
 * the automation outcome, and the run row records the failure.
 */
export const triggerRecordEventAutomations = (
  input: TriggerRecordEventInput
): Effect.Effect<
  void,
  never,
  | ExecuteAutomationRunRequirements
  | CommentRepository
  | DataSourceRepository
  | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, event, processEnv, userId } = input
    const { record, previousRecord } = readableRecords(input)
    // Entry point: one read of the operational pauses per record event.
    const pausedNames = yield* loadPausedAutomationNames
    const templates = yield* TemplateEngine
    const matchInput = { app, tableName, event, record, previousRecord, pausedNames }
    // Table, event and watchFields first: a table nothing watches costs no expansion.
    if (!anyRecordEntryMayMatch(matchInput)) return

    // The condition reads the expanded rows a step reads, before the
    // admin-only fields are removed: it is never stored.
    const hydrated = yield* buildRecordTriggerData({ ...input, record, previousRecord })
    const matching = findMatchingRecordAutomations(matchInput, {
      record: hydrated.record,
      previousRecord: hydrated.previousRecord,
      templates,
    })
    if (matching.length === 0) return

    const rows = withoutAdminOnlyTriggerFields(app, tableName, hydrated)
    const requester = yield* input.identify ?? identifyRequesterIfAny(input.requester)
    const triggerData = requester === undefined ? rows : { ...rows, requester }

    yield* Effect.forEach(
      matching,
      ({ automation, trigger }) =>
        dispatchAutomationOnce({
          automation,
          trigger,
          app,
          processEnv,
          triggerData: triggerData as TriggerData,
          userId,
          recordEventDepth: input.depth ?? 0,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[automation:record-event] dispatch failure', cause)
      })
    ),
    Effect.withSpan('automations.trigger-record-event-automations')
  )
