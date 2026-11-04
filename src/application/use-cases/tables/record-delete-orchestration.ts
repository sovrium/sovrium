/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path a single-record delete takes — to the trash, permanently, or
 * as a purge that takes the record's stored files with it — from the row as it
 * stood to the last side effect of the delete.
 *
 * Every door that deletes one record — the records API's DELETE, the native
 * form's POST, the MCP delete tool, the AI chat (once per row) and an
 * automation step — runs this program, each behind its own authorization, so
 * a delete made over one road cannot carry fewer side effects than the same
 * delete made over another.
 *
 * The order is fixed, and the unit tests pin it:
 *
 *  0. judge the table's business rules on the row as the door read it: a lock
 *     blocking `delete` keeps the row — and hand the same rules to the delete
 *  1. read the row as it stands, a live one (it feeds steps 4 and 5) and, for a
 *     purge, the one it removes, in the trash or not (it feeds step 3)
 *  2. delete (to the trash, or permanently), the rules judged once more INSIDE
 *     its transaction on the row as it stands there, so a delete racing a
 *     change that locks the row is judged on what that change left; recording
 *     the table's delete webhook deliveries in the same transaction
 *     — and, for a delete for good, the evidence of the signatures captured on
 *     the record (`forget-record-signatures.ts`), once the delete committed
 *  3. a purge only: delete the stored files of the row read in step 1 that no
 *     other record references — once the delete committed, so a delete refused
 *     or failed keeps every file
 *  4. dispatch the table's record-delete automations, handed the row as it stood
 *  5. deliver the webhook deliveries the delete recorded
 *
 * A permanent delete and a purge reach a row in the trash as well as a live
 * one: the rules judge it and a purge removes its files alike. A row already in
 * the trash fired its `delete` event when it went there, so steps 4–5 run for
 * a live row only.
 *
 * Steps 3–5 run only when the delete removed a row: not for a missing one, and
 * not for one a `restrict` link holds in place. The realtime `delete` event is
 * not published here — the delete program announces every row it removed,
 * cascaded children included, once the delete commits.
 */

import { Effect } from 'effect'
import { forgetRecordSignatures } from '@/application/use-cases/signatures/forget-record-signatures'
import { prepareRowOpRuleJudge, type prepareRuleJudge } from './permissions/business-rule-gate'
import { rawGetRecordIncludingTrashProgram, rawGetRecordProgram } from './read-record-programs'
import { deleteRecordProgram, permanentlyDeleteRecordProgram } from './record-lifecycle-programs'
import { purgeStoredAttachments } from './record-purge-attachments'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import type { StoredRow } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type {
  DeliveryMode,
  OutboxedWrite,
  RecordWebhookDispatcher,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/**
 * How a delete removes its row: to the trash, for good, or for good together
 * with the stored files only it references.
 */
export type DeleteMode = 'soft' | 'permanent' | 'purge'

/** What a delete answers, whatever its mode. */
export interface DeleteResult {
  readonly success: boolean
  /** A `set-null` link was cleared on a child record (soft delete only). */
  readonly setNullPerformed: boolean
  /** A `restrict` link kept the row in place (soft delete only). */
  readonly restrictViolation: boolean
}

/** Everything one delete needs to know about the caller and the record. */
export interface RecordDeleteInput {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  readonly mode: DeleteMode
  /** Who made the write, as the automations' `trigger.user`: absent for a write no person made. */
  readonly requester?: TriggerRequester
  /** The writer's groups: a refusal names a field only to a writer they let read it. */
  readonly userGroups?: readonly string[]
  /** Whether the write waits for its webhook deliveries; unnamed, the caller's receipt decides. */
  readonly deliveryMode?: DeliveryMode
  /** Forgets every derived variant of a stored file a purge deleted. */
  readonly forgetDerivedVariants: (key: string) => void
}

/**
 * The steps the orchestration is made of, each one bound to its port by
 * {@link deleteRecordWithSideEffects}. Separated so the ORDER is a
 * unit-testable property rather than a reading of the code.
 */
export interface RecordDeleteSteps<E, R, RD = never, RA = never> {
  /**
   * Refuse a delete the table's business rules forbid, before anything is
   * removed, and answer those rules for the delete to judge again inside its
   * transaction (`undefined` for a table without rules).
   */
  readonly authorizeRules: Effect.Effect<InTransactionRuleJudge | undefined, E, R>
  /** Remove the stored files of the row as it was read, once its delete committed. */
  readonly purgeAttachments: (row: StoredRow) => Effect.Effect<void, never, R>
  /** The live row, for the automations and webhooks; `null` for one in the trash. */
  readonly readRow: Effect.Effect<StoredRow | null, E, R>
  /** The row a purge removes, in the trash or not. */
  readonly readPurgedRow: Effect.Effect<StoredRow | null, E, R>
  readonly remove: (
    judge: InTransactionRuleJudge | undefined
  ) => Effect.Effect<OutboxedWrite<DeleteResult>, E, R | RD>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
}

/** Whether the delete removed a row: it existed, and no `restrict` link held it. */
export const removedARow = (result: DeleteResult): boolean =>
  result.success && !result.restrictViolation

/**
 * The delete, in the order the module header documents, over abstract steps.
 * Resolves to what the delete answered.
 */
export function orchestrateRecordDelete<E, R, RD = never, RA = never>(
  input: Pick<RecordDeleteInput, 'app' | 'tableName' | 'mode' | 'requester'> & {
    readonly userId: string
  },
  steps: RecordDeleteSteps<E, R, RD, RA>
): Effect.Effect<DeleteResult, E, R | RD | RA> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    const judge = yield* steps.authorizeRules
    const previous = yield* steps.readRow
    const purged = input.mode === 'purge' ? yield* steps.readPurgedRow : null
    const removed = yield* steps.remove(judge)
    const result = removed.value
    if (!removedARow(result)) return result
    if (purged) yield* steps.purgeAttachments(purged)
    // A missing row, or one held in place, fires nothing: dispatching against
    // an empty record would surface as `undefined` for every
    // `{{trigger.data.record.X}}`. Nor does one already in the trash: its
    // soft delete fired the one `delete` event.
    if (!previous) return result
    yield* steps.dispatchAutomations({
      app,
      tableName,
      event: 'delete',
      record: { ...previous },
      userId: input.userId,
      ...(input.requester === undefined ? {} : { requester: input.requester }),
    })
    yield* steps.deliverWebhooks(removed.deliveryIds)
    return result
  }).pipe(
    Effect.withSpan('tables.orchestrate-record-delete', {
      attributes: { tableName, mode: input.mode },
    })
  )
}

/** A permanent delete answers a bare boolean; read it as every delete answers. */
const asDeleteResult = (success: boolean): DeleteResult => ({
  success,
  setNullPerformed: false,
  restrictViolation: false,
})

/**
 * The row a delete removes, as it stands: a permanent delete or a purge reaches
 * a row in the trash too, a delete to the trash only a live one.
 */
const readDeletedRow = (input: RecordDeleteInput) => {
  const { session, tableName, recordId, app } = input
  return input.mode === 'soft'
    ? rawGetRecordProgram(session, tableName, recordId, app)
    : rawGetRecordIncludingTrashProgram(session, tableName, recordId, app)
}

/**
 * The rules' step of a delete: the table's rules judged on the row as the door
 * read it, and handed on for the delete to judge again inside its transaction.
 * A row that does not exist is left to the delete, which answers it is not found.
 */
const deleteRulesStep = (input: RecordDeleteInput) => {
  const { session, app, tableName, recordId } = input
  return prepareRowOpRuleJudge(
    {
      ...{ app, tableName, userId: session.userId },
      ...(input.requester === undefined ? {} : { userRole: input.requester.role }),
      ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
    },
    { op: 'delete', recordId },
    readDeletedRow(input)
  ).pipe(Effect.withSpan('tables.delete-rules-step', { attributes: { tableName } }))
}

/**
 * One delete with every side effect it carries, its record automations started by
 * `dispatchAutomations`: the records API's own dispatch for every road but an
 * automation step, which hands its run's record-event channel (see
 * `record-write-roads.ts`). Fails with the write's own errors.
 */
export function deleteRecordVia<RA>(
  input: RecordDeleteInput,
  dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
) {
  const { session, app, tableName, recordId, mode } = input
  return orchestrateRecordDelete<
    | Effect.Error<ReturnType<typeof deleteRecordProgram>>
    | Effect.Error<ReturnType<typeof permanentlyDeleteRecordProgram>>,
    | Effect.Services<ReturnType<typeof deleteRecordProgram>>
    | Effect.Services<ReturnType<typeof prepareRuleJudge>>
    | Effect.Services<ReturnType<typeof purgeStoredAttachments>>
    | Effect.Services<ReturnType<typeof forgetRecordSignatures>>,
    RecordWebhookDispatcher,
    RA
  >(
    { ...input, userId: session.userId },
    {
      authorizeRules: deleteRulesStep(input),
      purgeAttachments: (row) =>
        purgeStoredAttachments({
          ...{ session, app, tableName, recordId, row },
          forgetDerivedVariants: input.forgetDerivedVariants,
        }),
      // `app` so this pre-fetch refuses a table with no single-value record
      // address, rather than being the statement that names its missing `id`.
      readRow: rawGetRecordProgram(session, tableName, recordId, app),
      readPurgedRow: readDeletedRow(input),
      remove: (judge) =>
        (mode === 'soft'
          ? deleteRecordProgram(session, tableName, recordId, { app, judge })
          : Effect.map(
              permanentlyDeleteRecordProgram(session, tableName, recordId, { app, judge }),
              asDeleteResult
            )
        ).pipe(
          withRecordWebhooks(app, tableName),
          Effect.tap((removed) =>
            mode !== 'soft' && removedARow(removed.value)
              ? forgetRecordSignatures({
                  ...{ tableName, recordId },
                  forgetDerivedVariants: input.forgetDerivedVariants,
                })
              : Effect.void
          )
        ),
      dispatchAutomations,
      deliverWebhooks: (deliveryIds) => deliverRecordWebhooks(app, deliveryIds, input.deliveryMode),
    }
  ).pipe(Effect.withSpan('tables.delete-record-with-side-effects', { attributes: { tableName } }))
}
