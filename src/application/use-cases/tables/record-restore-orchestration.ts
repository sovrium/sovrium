/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path a single-record restore takes, from the trash to the last side
 * effect of bringing the record back.
 *
 * A restored record is not a new one and has not changed: it fires the
 * additive `restore` event, never `create` (every « welcome » automation would
 * run again) nor `update`. The order is fixed, and the unit tests pin it:
 *
 *  1. restore, recording the table's restore webhook deliveries in the same
 *     transaction
 *  2. dispatch the table's record-restore automations, handed the record as restored
 *  3. deliver the webhook deliveries the restore recorded
 *
 * A restore that fails — a missing row, one that is not in the trash — runs no
 * side effect. The route keeps its own gate (the delete role and the row-level
 * rules, judged on the trashed row); this program authorizes nothing.
 */

import { Effect } from 'effect'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { restoreRecordProgram } from './record-lifecycle-programs'
import { storedRowOf } from './record-stored-row'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { OutboxedWrite } from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** What a restore answers: the record as the caller may read it. */
export type RestoredRecord = Effect.Success<ReturnType<typeof restoreRecordProgram>>

/** Everything one restore needs to know about the caller and the record. */
export interface RecordRestoreInput {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  readonly userRole?: string
  readonly userGroups?: readonly string[]
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
}

/** The steps the orchestration is made of, so the ORDER is unit-testable. */
export interface RecordRestoreSteps<E, R, RD = never, RA = never> {
  readonly restore: Effect.Effect<OutboxedWrite<RestoredRecord>, E, R | RD>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
}

/** The restore, in the order the module header documents, over abstract steps. */
export function orchestrateRecordRestore<E, R, RD = never, RA = never>(
  input: Pick<RecordRestoreInput, 'app' | 'tableName' | 'processEnv'> & { readonly userId: string },
  steps: RecordRestoreSteps<E, R, RD, RA>
): Effect.Effect<RestoredRecord, E, R | RD | RA> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    const restored = yield* steps.restore
    yield* steps.dispatchAutomations({
      app,
      tableName,
      event: 'restore',
      record: { ...storedRowOf(restored.value.record) },
      processEnv: input.processEnv,
      userId: input.userId,
    })
    yield* steps.deliverWebhooks(restored.deliveryIds)
    return restored.value
  }).pipe(Effect.withSpan('tables.orchestrate-record-restore', { attributes: { tableName } }))
}

/**
 * Restore one record from the trash and run every side effect the restore
 * carries. Fails with the restore's own errors.
 */
export function restoreRecordWithSideEffects(input: RecordRestoreInput) {
  const { session, app, tableName, recordId } = input
  return orchestrateRecordRestore(
    { ...input, userId: session.userId },
    {
      restore: restoreRecordProgram(session, tableName, recordId, {
        app,
        ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
        ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
      }).pipe(withRecordWebhooks(app, tableName, 'restore')),
      dispatchAutomations: triggerRecordEventAutomations,
      deliverWebhooks: (deliveryIds) => deliverRecordWebhooks(app, deliveryIds, 'await'),
    }
  ).pipe(Effect.withSpan('tables.restore-record-with-side-effects', { attributes: { tableName } }))
}
