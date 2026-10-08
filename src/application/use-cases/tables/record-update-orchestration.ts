/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE path a records-API update takes, from the row as it stood to the
 * last side effect of the write.
 *
 * Every door that updates one record — the records API's PATCH, the native
 * form, a form edit link, the MCP tool, the AI chat (once per row) and an
 * automation step — runs this program, each behind its own authorization.
 * Whether or not a record-update automation watches the table, an update runs
 * this one program, so the side effects cannot differ between the two cases —
 * a replaced attachment's stored file, for one, is deleted in both; keeping it
 * would leave an object in the bucket that no record names.
 *
 * The order is fixed, and the unit tests pin it:
 *
 *  1. read the operational pauses — is a record-update automation armed?
 *  2. read the row as it stands (it feeds steps 3, 5, 6 and 8)
 *  3. stamp `published_at` on first publication, merge the SQLite AI baseline
 *  4. write (the optimistic-lock token is compared INSIDE the write), recording
 *     the table's update webhook deliveries in the same transaction
 *  5. dispatch the armed automations, with the previous row for `watchFields`
 *  6. deliver the webhook deliveries the write recorded
 *  7. signal the AI-compute write phase, detached — it outlives the request
 *  8. delete the stored files the write replaced
 *
 * Steps 6–8 run only when the write touched a row.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { logError } from '@/infrastructure/logging/logger'
import { rawGetRecordProgram } from './read-record-programs'
import { storedRowOf } from './record-stored-row'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import { updateRecordProgram } from './write-record-programs'
import type { LinkReader } from './linked-row-visibility'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  DeliveryMode,
  OutboxedWrite,
  RecordWebhookDispatcher,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** A row as the driver returns it: column name → stored value. */
export type StoredRow = Readonly<Record<string, unknown>>

/** The write's answer: the record as the writer may read it, or `{}` for no row. */
export type UpdatedRecord = Effect.Success<ReturnType<typeof updateRecordProgram>>

/** A superseded stored object, paired with the bucket it was written under. */
export interface ReplacedAttachment {
  readonly key: string
  readonly bucket: string
}

/** Everything one update needs to know about the caller and the change. */
export interface RecordUpdateInput {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  /** The fields the caller may write, as they asked to write them. */
  readonly fields: StoredRow
  /** The caller's role, which judges the echo; absent for a write no person made. */
  readonly userRole?: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
  /** The reader the write's echo judges link targets as. */
  readonly linkReader?: LinkReader
  /** The `updatedAt` the caller last read, when it sent one. */
  readonly expectedUpdatedAt?: string
  /** The surface the change is recorded as made through (a form edit link). */
  readonly auditContext?: Readonly<Record<string, string>>
  /** Whether the runtime engine is SQLite, which has no BEFORE trigger for the AI baseline. */
  readonly isSqlite: boolean
  /** Process env captured at the route boundary, for the automations' `$env` lookups. */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** Whether the request waits for its webhook deliveries (it does, by default). */
  readonly deliveryMode?: DeliveryMode
  /**
   * Whether the stored files the write replaced are deleted (`delete`, the
   * default). An automation step keeps them: its own attach step deletes a
   * replaced file only once no record names it any more.
   */
  readonly replacedAttachments?: 'delete' | 'keep'
  /**
   * Forgets every derived variant (resized, converted) of a stored file the
   * write replaced, once the file itself is deleted — or a variant would keep
   * being served after the bytes it was derived from are gone.
   */
  readonly forgetDerivedVariants: (key: string) => void
}

/**
 * The steps the orchestration is made of, each one bound to its port by
 * {@link updateRecordWithSideEffects}. Separated so the ORDER is a unit-testable
 * property rather than a reading of the code.
 */
export interface RecordUpdateSteps<E, R, RD = never, RA = never> {
  readonly loadPausedNames: Effect.Effect<ReadonlySet<string>, never, R>
  readonly readRow: Effect.Effect<StoredRow | undefined, never, R>
  readonly write: (fields: StoredRow) => Effect.Effect<OutboxedWrite<UpdatedRecord>, E, R | RD>
  readonly dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
  readonly deliverWebhooks: (deliveryIds: readonly string[]) => Effect.Effect<void, never, RD>
  readonly signalAiCompute: (
    record: StoredRow,
    old: StoredRow | undefined
  ) => Effect.Effect<void, never, R>
  readonly deleteAttachments: (refs: readonly ReplacedAttachment[]) => Effect.Effect<void, never, R>
}

/** The table an update addresses, in the app that declares it. */
export interface UpdateScope {
  readonly app: App
  readonly tableName: string
}

const tableOf = ({ app, tableName }: UpdateScope) => app.tables?.find((t) => t.name === tableName)

/**
 * Auto-`published_at` convention: a table with a `single-select` `status` and a
 * `datetime` `published_at` gets `published_at` stamped the FIRST time `status`
 * becomes `'published'`. A value the caller sent always wins, and re-saving a
 * row that is already published keeps its original publication date.
 */
export function applyPublishedAtConvention(
  scope: UpdateScope,
  previous: StoredRow | undefined,
  fields: StoredRow,
  nowIso: string
): StoredRow {
  const declared = tableOf(scope)?.fields ?? []
  const hasStatus = declared.some((f) => f.name === 'status' && f.type === 'single-select')
  const hasPublishedAt = declared.some((f) => f.name === 'published_at' && f.type === 'datetime')
  if (!hasStatus || !hasPublishedAt) return fields
  if (fields['status'] !== 'published' || 'published_at' in fields) return fields
  if (previous?.['status'] === 'published') return fields
  return { ...fields, published_at: nowIso }
}

/**
 * SQLite has no procedural language, so the AI-compute baseline PostgreSQL
 * computes in a BEFORE trigger is merged into the write here, landing in the
 * same UPDATE. No-op on PostgreSQL and for tables without AI-compute fields.
 */
export function mergeAiBaseline(
  scope: UpdateScope,
  fields: StoredRow,
  previous: StoredRow | undefined,
  isSqlite: boolean
): StoredRow {
  const table = tableOf(scope)
  if (!table || !isSqlite) return fields
  return {
    ...fields,
    ...applyAiComputeBaseline({ table, op: 'update', incoming: fields, old: previous }),
  }
}

/**
 * The stored files a write replaces: every `single-attachment` field the write
 * names whose previous value is a non-empty key different from the new one.
 */
export function collectReplacedAttachments(
  scope: UpdateScope,
  previous: StoredRow,
  written: StoredRow
): readonly ReplacedAttachment[] {
  const { app, tableName } = scope
  return (tableOf(scope)?.fields ?? [])
    .filter((f) => f.type === 'single-attachment' && f.name in written)
    .flatMap((f) => {
      const old = previous[f.name]
      if (typeof old !== 'string' || old.length === 0 || old === written[f.name]) return []
      return [
        { key: old, bucket: resolveFieldBucket(app, tableName, f.name) ?? SYSTEM_BUCKET_NAME },
      ]
    })
}

/** Whether a live (not paused) record-update automation targets this table. */
export function hasArmedUpdateTrigger(
  { app, tableName }: UpdateScope,
  pausedNames: ReadonlySet<string>
): boolean {
  return (app.automations ?? []).some(
    (automation) =>
      isAutomationOperationallyEnabled(automation, pausedNames) &&
      automation.trigger.type === 'record' &&
      automation.trigger.table === tableName &&
      automation.trigger.events.includes('update')
  )
}

/**
 * A write that touched a row: the record as its writer may read it — system
 * fields at the root, the user fields under `fields` (and flat at the root).
 */
export interface WrittenRecord {
  readonly id: string
  readonly fields: StoredRow
  readonly createdAt: string
  readonly updatedAt: string
}

/** Whether the write touched a row — a pure many-to-many PATCH of a missing row answers `{}`. */
const isWritten = (updated: UpdatedRecord): updated is UpdatedRecord & WrittenRecord =>
  Object.keys(updated).length > 0

/** The written record as a flat field map with its id — what automations read. */
export function flattenUpdatedRecord(updated: WrittenRecord): StoredRow {
  return { id: updated.id, ...updated.fields }
}

/**
 * The update, in the order the module header documents, over abstract steps.
 * Resolves to the written record, or `undefined` when the write touched no row.
 */
export function orchestrateRecordUpdate<E, R, RD = never, RA = never>(
  input: Pick<RecordUpdateInput, 'app' | 'tableName' | 'fields' | 'isSqlite' | 'processEnv'> & {
    readonly userId: string
    /** When the update happens, as an ISO 8601 instant. */
    readonly nowIso: string
  },
  steps: RecordUpdateSteps<E, R, RD, RA>
): Effect.Effect<WrittenRecord | undefined, E, R | RD | RA> {
  const { app, tableName } = input
  return Effect.gen(function* () {
    const armed = hasArmedUpdateTrigger(input, yield* steps.loadPausedNames)
    const previous = yield* steps.readRow
    const published = applyPublishedAtConvention(input, previous, input.fields, input.nowIso)
    const fields = mergeAiBaseline(input, published, previous, input.isSqlite)
    const written = yield* steps.write(fields)
    const updated = written.value
    if (armed) {
      yield* steps.dispatchAutomations({
        app,
        tableName,
        event: 'update',
        record: isWritten(updated) ? storedRowOf(updated) : {},
        ...(previous === undefined ? {} : { previousRecord: { ...previous } }),
        processEnv: input.processEnv,
        userId: input.userId,
      })
    }
    if (!isWritten(updated)) return undefined
    yield* steps.deliverWebhooks(written.deliveryIds)
    // The incoming map for override detection is the caller's own, pre-baseline.
    yield* steps.signalAiCompute(flattenUpdatedRecord(updated), previous)
    if (previous !== undefined) {
      yield* steps.deleteAttachments(collectReplacedAttachments(input, previous, fields))
    }
    return updated
  }).pipe(Effect.withSpan('tables.orchestrate-record-update', { attributes: { tableName } }))
}

/**
 * Delete stored files, one at a time, each failure logged and swallowed: a file
 * already gone must never fail the update that superseded it.
 */
const deleteStoredFiles = (
  refs: readonly ReplacedAttachment[],
  forgetDerivedVariants: (key: string) => void
) =>
  Effect.forEach(
    refs,
    ({ key, bucket }) =>
      Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
        yield* Effect.sync(() => forgetDerivedVariants(key))
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[tables] could not delete a replaced attachment', cause, { key, bucket })
          )
        ),
        // effect-swallow: the record already points at its new file; an object
        // that cannot be removed is logged above and must not undo the update.
        Effect.ignoreCause
      ),
    { discard: true }
  )

/** What the update's own steps run on — the automations' dispatch aside. */
type UpdateRequirements =
  | Effect.Services<ReturnType<typeof updateRecordProgram>>
  | Effect.Services<typeof loadPausedAutomationNames>
  | Effect.Services<ReturnType<typeof signalAiComputeWritePhase>>
  | StorageService

/**
 * The row an update replaces. It only feeds the conventions and the cleanup:
 * a failed read leaves them without a previous row, and the write reports its
 * own error.
 */
const readReplacedRow = ({ session, tableName, recordId }: RecordUpdateInput) =>
  rawGetRecordProgram(session, tableName, recordId).pipe(
    Effect.map((row) => row ?? undefined),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[tables] could not read the row an update replaces', cause, { tableName })
      )
    ),
    // effect-swallow: the read only feeds the conventions and the cleanup;
    // logged above, and the write that follows reports its own failure.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * One update with every side effect it carries, its record automations started by
 * `dispatchAutomations`: the records API's own dispatch for every road but an
 * automation step, which hands its run's record-event channel (see
 * `record-write-roads.ts`). Fails with the write's own errors.
 */
export function updateRecordVia<RA>(
  input: RecordUpdateInput,
  dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
) {
  const { session, app, tableName, recordId } = input
  type WriteError = Effect.Error<ReturnType<typeof updateRecordProgram>>
  return orchestrateRecordUpdate<WriteError, UpdateRequirements, RecordWebhookDispatcher, RA>(
    { ...input, userId: session.userId, nowIso: new Date().toISOString() },
    {
      loadPausedNames: loadPausedAutomationNames,
      readRow: readReplacedRow(input),
      write: (fields) =>
        updateRecordProgram(session, tableName, recordId, {
          fields,
          app,
          ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
          ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
          ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
          ...(input.expectedUpdatedAt === undefined
            ? {}
            : { expectedUpdatedAt: input.expectedUpdatedAt }),
          ...(input.auditContext === undefined ? {} : { auditContext: input.auditContext }),
        }).pipe(withRecordWebhooks(app, tableName)),
      dispatchAutomations,
      deliverWebhooks: (deliveryIds) =>
        deliverRecordWebhooks(app, deliveryIds, input.deliveryMode ?? 'await'),
      // Detached: the enqueue and its status writes outlive the request, and
      // read the same `AiService` this program was provided.
      signalAiCompute: (record, old) =>
        Effect.asVoid(
          Effect.forkDetach(
            signalAiComputeWritePhase({
              app,
              tableName,
              op: 'update',
              recordId,
              incoming: input.fields,
              old,
              record,
            })
          )
        ),
      deleteAttachments: (refs) =>
        input.replacedAttachments === 'keep'
          ? Effect.void
          : deleteStoredFiles(refs, input.forgetDerivedVariants),
    }
  ).pipe(Effect.withSpan('tables.update-record-with-side-effects', { attributes: { tableName } }))
}
