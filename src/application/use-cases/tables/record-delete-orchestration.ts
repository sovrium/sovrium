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
 *  1. a purge only: delete the stored files no other record references
 *  2. read the row as it stands (it feeds steps 4 and 5)
 *  3. delete (to the trash, or permanently), recording the table's delete
 *     webhook deliveries in the same transaction
 *  4. dispatch the table's record-delete automations, handed the row as it stood
 *  5. deliver the webhook deliveries the delete recorded
 *
 * Steps 4–5 run only when the delete removed a row: not for a missing one, and
 * not for one a `restrict` link holds in place. The realtime `delete` event is
 * not published here — the delete program announces every row it removed,
 * cascaded children included, once the delete commits.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from './read-record-programs'
import { deleteRecordProgram, permanentlyDeleteRecordProgram } from './record-lifecycle-programs'
import { purgeStoredAttachments } from './record-purge-attachments'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import type { StoredRow } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  DeliveryMode,
  OutboxedWrite,
  RecordWebhookDispatcher,
} from '@/application/ports/services/record-webhook-dispatcher'
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
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** Whether the request waits for its webhook deliveries (it does, by default). */
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
  readonly purgeAttachments: Effect.Effect<void, never, R>
  readonly readRow: Effect.Effect<StoredRow | null, E, R>
  readonly remove: Effect.Effect<OutboxedWrite<DeleteResult>, E, R | RD>
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
  input: Pick<RecordDeleteInput, 'app' | 'tableName' | 'mode' | 'processEnv'> & {
    readonly userId: string
  },
  steps: RecordDeleteSteps<E, R, RD, RA>
): Effect.Effect<DeleteResult, E, R | RD | RA> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    if (input.mode === 'purge') yield* steps.purgeAttachments
    const previous = yield* steps.readRow
    const removed = yield* steps.remove
    const result = removed.value
    // A missing row, or one held in place, fires nothing: dispatching against
    // an empty record would surface as `undefined` for every
    // `{{trigger.data.record.X}}`. It recorded no delivery either.
    if (!removedARow(result) || !previous) return result
    yield* steps.dispatchAutomations({
      app,
      tableName,
      event: 'delete',
      record: { ...previous },
      processEnv: input.processEnv,
      userId: input.userId,
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
    Effect.Error<ReturnType<typeof deleteRecordProgram>>,
    | Effect.Services<ReturnType<typeof deleteRecordProgram>>
    | Effect.Services<ReturnType<typeof purgeStoredAttachments>>,
    RecordWebhookDispatcher,
    RA
  >(
    { ...input, userId: session.userId },
    {
      purgeAttachments: purgeStoredAttachments({
        ...{ session, app, tableName, recordId },
        forgetDerivedVariants: input.forgetDerivedVariants,
      }),
      // `app` so this pre-fetch refuses a table with no single-value record
      // address, rather than being the statement that names its missing `id`.
      readRow: rawGetRecordProgram(session, tableName, recordId, app),
      remove: (mode === 'soft'
        ? deleteRecordProgram(session, tableName, recordId, app)
        : Effect.map(
            permanentlyDeleteRecordProgram(session, tableName, recordId, app),
            asDeleteResult
          )
      ).pipe(withRecordWebhooks(app, tableName)),
      dispatchAutomations,
      deliverWebhooks: (deliveryIds) =>
        deliverRecordWebhooks(app, deliveryIds, input.deliveryMode ?? 'await'),
    }
  ).pipe(Effect.withSpan('tables.delete-record-with-side-effects', { attributes: { tableName } }))
}
