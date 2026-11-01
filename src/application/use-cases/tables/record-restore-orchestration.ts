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
 * Before step 1, the table's business rules judge the restore as an update
 * that changes no field, on the trashed row as it will stand restored — once
 * for an early answer, and again inside the restore's transaction, the
 * judgement that binds.
 *
 * A restore that fails — a missing row, one that is not in the trash, one a
 * rule refuses — runs no side effect. The route keeps its own gate (the delete
 * role and the row-level rules, judged on the trashed row); this program
 * authorizes nothing else.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { rowAsRestored } from '@/domain/models/app/tables/business-rule-service'
import { prepareRowOpRuleJudge } from './permissions/business-rule-gate'
import { restoreRecordProgram } from './record-lifecycle-programs'
import { storedRowOf } from './record-stored-row'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import { dispatchRecordEventInBackground } from './record-write-roads'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { OutboxedWrite } from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
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
  /**
   * Who restored the record, as the automations' `trigger.user`: absent for a
   * write no person made. Named by the caller, never derived from `userRole`,
   * which is the authority the restore is judged under and may be a door's own.
   */
  readonly requester?: TriggerRequester
}

/** The steps the orchestration is made of, so the ORDER is unit-testable. */
export interface RecordRestoreSteps<E, R, RD = never, RA = never> {
  readonly restore: Effect.Effect<OutboxedWrite<RestoredRecord>, E, R | RD>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
}

/** The restore, in the order the module header documents, over abstract steps. */
export function orchestrateRecordRestore<E, R, RD = never, RA = never>(
  input: Pick<RecordRestoreInput, 'app' | 'tableName' | 'requester'> & {
    readonly userId: string
  },
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
      userId: input.userId,
      ...(input.requester === undefined ? {} : { requester: input.requester }),
    })
    yield* steps.deliverWebhooks(restored.deliveryIds)
    return restored.value
  }).pipe(Effect.withSpan('tables.orchestrate-record-restore', { attributes: { tableName } }))
}

/**
 * The rules' step of a restore: the table's rules judged on the trashed row as
 * the door read it, and handed on for the restore to judge again inside its
 * transaction. A row that is not in the trash is left to the restore, which
 * answers it.
 */
const restoreRulesStep = (input: RecordRestoreInput) => {
  const { session, app, tableName, recordId } = input
  return prepareRowOpRuleJudge(
    {
      ...{ app, tableName, userId: session.userId },
      ...(input.requester === undefined ? {} : { userRole: input.requester.role }),
      ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
    },
    { op: 'restore', recordId },
    Effect.gen(function* () {
      const repo = yield* TableRepository
      return rowAsRestored(yield* repo.getRecord(session, tableName, recordId, true))
    })
  ).pipe(Effect.withSpan('tables.restore-rules-step', { attributes: { tableName } }))
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
      restore: restoreRulesStep(input).pipe(
        Effect.flatMap((judge) =>
          restoreRecordProgram(session, tableName, recordId, {
            app,
            judge,
            ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
            ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
          })
        ),
        withRecordWebhooks(app, tableName, 'restore')
      ),
      dispatchAutomations: dispatchRecordEventInBackground,
      deliverWebhooks: (deliveryIds) => deliverRecordWebhooks(app, deliveryIds),
    }
  ).pipe(Effect.withSpan('tables.restore-record-with-side-effects', { attributes: { tableName } }))
}
