/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path a single-record create takes, from the fields the caller may
 * write to the last side effect of the write.
 *
 * Every door that files one record into a table — the records API's POST, the
 * MCP create tool, a hosted form, the AI chat and an automation step — runs
 * this program, so a create made over one road cannot carry fewer side
 * effects than the same create made over another. Each road keeps its own
 * authorization and hands this program the caller it already judged.
 *
 * The order is fixed, and the unit tests pin it:
 *
 *  1. merge the SQLite AI-compute baseline into the fields
 *  2. write (as the writer: the system for a signed-out visitor), recording
 *     the table's create webhook deliveries in the same transaction
 *  3. dispatch the table's record-create automations, as the caller
 *  4. deliver the webhook deliveries the write recorded
 *  5. signal the AI-compute write phase, detached — it outlives the request
 *
 * A write that fails runs no side effect and records no delivery. Steps 3–5
 * cannot fail the create: each absorbs its own failures.
 */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { resolveActorUserId } from '@/domain/models/app/auth/guest-session'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { storedRowOf } from './record-stored-row'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import { createRecordProgram } from './write-record-programs'
import type { LinkReader } from './linked-row-visibility'
import type { StoredRow, UpdateScope } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  DeliveryMode,
  OutboxedWrite,
  RecordWebhookDispatcher,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** The write's answer: the record as the caller may read it. */
export type CreatedRecord = Effect.Success<ReturnType<typeof createRecordProgram>>

/**
 * Who starts the record automations a write fires, when not the records API's
 * own dispatch — an automation step hands its run's record-event channel,
 * which keeps the depth limit and runs them in the background.
 */
export type RecordAutomationDispatch = (input: TriggerRecordEventInput) => Effect.Effect<void>

/** Everything one create needs to know about the caller and the record. */
export interface RecordCreateInput {
  /** The caller: the session its automations run as. */
  readonly session: Readonly<UserSession>
  /** Who the row is written as, when not the caller (the system, for a signed-out visitor). */
  readonly writer?: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  /** The validated fields, as the caller asked to write them (pre-baseline). */
  readonly fields: StoredRow
  /** The caller's role, which judges the echo; absent for a write no person made. */
  readonly userRole?: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
  /** The reader a link target is judged as — a visitor's record included. */
  readonly linkReader?: LinkReader
  /** The request origin, for the attachment URLs of the echo. */
  readonly origin?: string
  /** Whether the runtime engine is SQLite, which has no BEFORE trigger for the AI baseline. */
  readonly isSqlite: boolean
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Values the record automations read beneath the stored row — a form's
   * answers that no column stores. The row as stored always wins.
   */
  readonly triggerValues?: StoredRow
  /** Whether the request waits for its webhook deliveries (it does, by default). */
  readonly deliveryMode?: DeliveryMode
}

/**
 * The steps the orchestration is made of, each one bound to its port by
 * {@link createRecordWithSideEffects}. Separated so the ORDER is a
 * unit-testable property rather than a reading of the code.
 */
export interface RecordCreateSteps<E, R, RD = never, RA = never> {
  readonly write: (fields: StoredRow) => Effect.Effect<OutboxedWrite<CreatedRecord>, E, R | RD>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
  readonly signalAiCompute: (record: Readonly<CreatedRecord>) => Effect.Effect<void, never, R>
}

/**
 * SQLite has no procedural language, so the AI-compute baseline PostgreSQL
 * computes in a BEFORE trigger is merged into the write here, landing in the
 * SAME insert (the "never empty after write" invariant). No-op on PostgreSQL
 * and for tables without AI-compute fields.
 */
export function mergeCreateAiBaseline(
  { app, tableName }: UpdateScope,
  fields: StoredRow,
  isSqlite: boolean
): StoredRow {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table || !isSqlite) return fields
  return { ...fields, ...applyAiComputeBaseline({ table, op: 'insert', incoming: fields }) }
}

/**
 * Who made a records write, as its automations' `trigger.user`: the person
 * and her role. Absent for a signed-out visitor's write, for one the system
 * made, and for one written with no caller role (a form's own authority).
 */
export function recordWriteRequester(
  userId: string,
  userRole: string | undefined
): TriggerRequester | undefined {
  const person = resolveActorUserId(userId)
  return person === undefined || userRole === undefined ? undefined : { id: person, role: userRole }
}

/**
 * The create, in the order the module header documents, over abstract steps.
 * Resolves to the written record as the caller may read it.
 */
export function orchestrateRecordCreate<E, R, RD = never, RA = never>(
  input: Pick<
    RecordCreateInput,
    'app' | 'tableName' | 'fields' | 'isSqlite' | 'processEnv' | 'triggerValues'
  > & {
    /** The caller the automations run as — never the writer. */
    readonly userId: string
    /** Who made the write, as the automations' `trigger.user`: absent for a guest. */
    readonly requester?: TriggerRequester
  },
  steps: RecordCreateSteps<E, R, RD, RA>
): Effect.Effect<CreatedRecord, E, R | RD | RA> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    const written = yield* steps.write(mergeCreateAiBaseline(input, input.fields, input.isSqlite))
    const record = written.value
    yield* steps.dispatchAutomations({
      app,
      tableName,
      event: 'create',
      record: { ...input.triggerValues, ...storedRowOf(record) },
      processEnv: input.processEnv,
      userId: input.userId,
      ...(input.requester === undefined ? {} : { requester: input.requester }),
    })
    yield* steps.deliverWebhooks(written.deliveryIds)
    yield* steps.signalAiCompute(record)
    return record
  }).pipe(Effect.withSpan('tables.orchestrate-record-create', { attributes: { tableName } }))
}

/**
 * One create with every side effect it carries, its record automations started by
 * `dispatchAutomations`: the records API's own dispatch for every road but an
 * automation step, which hands its run's record-event channel (see
 * `record-write-roads.ts`). Fails with the write's own errors.
 */
export function createRecordVia<RA>(
  input: RecordCreateInput,
  dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
) {
  const { session, app, tableName } = input
  // A signed-out visitor's row is written as the system: no person made it.
  const requester = recordWriteRequester((input.writer ?? session).userId, input.userRole)
  return orchestrateRecordCreate<
    Effect.Error<ReturnType<typeof createRecordProgram>>,
    | Effect.Services<ReturnType<typeof createRecordProgram>>
    | Effect.Services<ReturnType<typeof signalAiComputeWritePhase>>,
    RecordWebhookDispatcher,
    RA
  >(
    { ...input, userId: session.userId, ...(requester === undefined ? {} : { requester }) },
    {
      write: (fields) =>
        createRecordProgram({
          session: input.writer ?? session,
          tableName,
          fields,
          app,
          ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
          ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
          ...(input.origin === undefined ? {} : { origin: input.origin }),
          ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
        }).pipe(withRecordWebhooks(app, tableName)),
      dispatchAutomations,
      deliverWebhooks: (deliveryIds) =>
        deliverRecordWebhooks(app, deliveryIds, input.deliveryMode ?? 'await'),
      // Detached: the enqueue and its status writes outlive the request, and
      // read the same `AiService` this program was provided. A user override is
      // recorded as `skipped` on both engines (the PostgreSQL trigger
      // short-circuits before NOTIFY); a computed field is enqueued on SQLite.
      signalAiCompute: (record) =>
        Effect.asVoid(
          Effect.forkDetach(
            signalAiComputeWritePhase({
              app,
              tableName,
              op: 'insert',
              recordId: record.id,
              // The incoming map for override detection is the caller's own, pre-baseline.
              incoming: input.fields,
              record: record.fields,
            })
          )
        ),
    }
  ).pipe(Effect.withSpan('tables.create-record-with-side-effects', { attributes: { tableName } }))
}
