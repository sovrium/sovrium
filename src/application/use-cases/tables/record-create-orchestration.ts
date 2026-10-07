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
 * Every door that files one record into a table — the records API's POST and
 * the MCP create tool — runs this program, so a create made over one
 * transport cannot carry fewer side effects than the same create made over
 * another.
 *
 * The order is fixed, and the unit tests pin it:
 *
 *  1. merge the SQLite AI-compute baseline into the fields
 *  2. write (as the writer: the system for a signed-out visitor)
 *  3. dispatch the table's record-create automations, as the caller
 *  4. dispatch the table's create webhooks
 *  5. signal the AI-compute write phase, detached — it outlives the request
 *
 * A write that fails runs no side effect. Steps 3–5 cannot fail the create:
 * each absorbs its own failures.
 */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { createRecordProgram } from './write-record-programs'
import type { LinkReader } from './linked-row-visibility'
import type { StoredRow, UpdateScope } from './record-update-orchestration'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** The write's answer: the record as the caller may read it. */
export type CreatedRecord = Effect.Success<ReturnType<typeof createRecordProgram>>

/** What a table's create webhooks are handed: the flat record plus its system timestamps. */
export interface CreateWebhookPayload {
  readonly record: StoredRow
}

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
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
  /** The reader a link target is judged as — a visitor's record included. */
  readonly linkReader: LinkReader
  /** The request origin, for the attachment URLs of the echo. */
  readonly origin?: string
  /** Whether the runtime engine is SQLite, which has no BEFORE trigger for the AI baseline. */
  readonly isSqlite: boolean
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** Delivers the table's create webhooks. Must not fail: a down endpoint never fails the write. */
  readonly dispatchWebhooks: (payload: CreateWebhookPayload) => Effect.Effect<void>
}

/**
 * The steps the orchestration is made of, each one bound to its port by
 * {@link createRecordWithSideEffects}. Separated so the ORDER is a
 * unit-testable property rather than a reading of the code.
 */
export interface RecordCreateSteps<E, R> {
  readonly write: (fields: StoredRow) => Effect.Effect<CreatedRecord, E, R>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, R>
  readonly dispatchWebhooks: (payload: CreateWebhookPayload) => Effect.Effect<void, never, R>
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
 * The create, in the order the module header documents, over abstract steps.
 * Resolves to the written record as the caller may read it.
 */
export function orchestrateRecordCreate<E, R>(
  input: Pick<RecordCreateInput, 'app' | 'tableName' | 'fields' | 'isSqlite' | 'processEnv'> & {
    /** The caller the automations run as — never the writer. */
    readonly userId: string
  },
  steps: RecordCreateSteps<E, R>
): Effect.Effect<CreatedRecord, E, R> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    const record = yield* steps.write(mergeCreateAiBaseline(input, input.fields, input.isSqlite))
    yield* steps.dispatchAutomations({
      app,
      tableName,
      event: 'create',
      record: { id: record.id, ...record.fields },
      processEnv: input.processEnv,
      userId: input.userId,
    })
    yield* steps.dispatchWebhooks({
      record: {
        id: record.id,
        ...record.fields,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    })
    yield* steps.signalAiCompute(record)
    return record
  }).pipe(Effect.withSpan('tables.orchestrate-record-create', { attributes: { tableName } }))
}

/**
 * Create one record and run every side effect the create carries, on the
 * caller's services. Fails with the write's own errors.
 */
export function createRecordWithSideEffects(input: RecordCreateInput) {
  const { session, app, tableName } = input
  return orchestrateRecordCreate(
    { ...input, userId: session.userId },
    {
      write: (fields) =>
        createRecordProgram({
          session: input.writer ?? session,
          tableName,
          fields,
          app,
          userRole: input.userRole,
          userGroups: input.userGroups,
          ...(input.origin === undefined ? {} : { origin: input.origin }),
          linkReader: input.linkReader,
        }),
      dispatchAutomations: triggerRecordEventAutomations,
      dispatchWebhooks: input.dispatchWebhooks,
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
