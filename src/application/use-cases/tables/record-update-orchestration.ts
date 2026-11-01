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
 *  0. clean the values and check their formats (`record-write-values.ts`)
 *  1. read the operational pauses — is a record-update automation armed?
 *  2. read the row as it stands (it feeds the rules and steps 3, 5, 6 and 8)
 *  2b. judge the table's business rules on the stored row and the change —
 *     after every permission was judged by the door, so a caller who cannot
 *     reach the row was answered 404 before any rule speaks
 *  3. stamp `published_at` on first publication, merge the SQLite AI baseline
 *  4. write — the rules judged again INSIDE its transaction, on the row as it
 *     stands there, and the lock token compared — recording its deliveries
 *  5. dispatch the armed automations, with the previous row for `watchFields`
 *  6. deliver the webhook deliveries the write recorded
 *  7. signal the AI-compute write phase, detached — it outlives the request
 *  8. delete the stored files the write replaced
 *
 * Steps 6–8 run only when the write touched a row.
 */

import { Effect } from 'effect'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai/enqueue-refinement'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { startInTrackedBackground } from '@/application/use-cases/automations/tracked-background'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { triggersOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { judgedRowsOf, prepareRuleJudge, refuseUnderRules } from './permissions/business-rule-gate'
import { storedRowOf } from './record-stored-row'
import {
  collectReplacedAttachments,
  deleteStoredFiles,
  readPreviousLinkLists,
  readReplacedRow,
  type ReplacedAttachment,
} from './record-update-replaced'
import { deliverRecordWebhooks, withRecordWebhooks } from './record-webhook-outbox'
import { checkedWriteValues } from './record-write-values'
import { updateRecordProgram } from './write-record-programs'
import type { LinkReader } from './linked-row-visibility'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import type {
  DeliveryMode,
  OutboxedWrite,
  RecordWebhookDispatcher,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerRecordEventInput } from '@/application/use-cases/automations/trigger-record-event'
import type { App } from '@/domain/models/app'

/** A row as the driver returns it: column name → stored value. */
export type StoredRow = Readonly<Record<string, unknown>>

/** The write's answer: the record as the writer may read it, or `{}` for no row. */
export type UpdatedRecord = Effect.Success<ReturnType<typeof updateRecordProgram>>

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
  /** Who made the write, as the automations' `trigger.user`: absent for a write no person made. */
  readonly requester?: TriggerRequester
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
  /** The reader the write's echo judges link targets as. */
  readonly linkReader?: LinkReader
  /** The `updatedAt` the caller last read, when it sent one. */
  readonly expectedUpdatedAt?: string
  /** The surface the change is recorded as made through (a form edit link). */
  readonly auditContext?: Readonly<Record<string, string>>
  /** `replace`: a many-to-many list is the whole set kept, not links to add. */
  readonly linkLists?: 'replace'
  /** Whether the runtime engine is SQLite, which has no BEFORE trigger for the AI baseline. */
  readonly isSqlite: boolean
  /** Whether the write waits for its webhook deliveries; unnamed, the caller's receipt decides. */
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
  /** The request origin, for the attachment URLs of the echo. */
  readonly origin?: string
}

/**
 * The steps the orchestration is made of, each one bound to its port by
 * {@link updateRecordWithSideEffects}. Separated so the ORDER is a unit-testable
 * property rather than a reading of the code.
 */
export interface RecordUpdateSteps<E, R, RD = never, RA = never> {
  readonly loadPausedNames: Effect.Effect<ReadonlySet<string>, never, R>
  /**
   * The row as it stood, `undefined` when there is none. A read that fails
   * fails the update: its rules cannot be judged, so it is never written.
   */
  readonly readRow: Effect.Effect<StoredRow | undefined, E, R>
  /**
   * Refuse a change the table's business rules forbid, judged on the row as it
   * stood, and answer those rules for the write to judge again inside its
   * transaction (`undefined` for a table without rules).
   */
  readonly authorizeRules: (
    previous: StoredRow | undefined,
    fields: StoredRow
  ) => Effect.Effect<InTransactionRuleJudge | undefined, E, R>
  /** The row as it stood, with the many-to-many links the change names as they stood. */
  readonly readPreviousLinks: (previous: StoredRow) => Effect.Effect<StoredRow, never, R>
  /** Write the change, `judge` judging it on the row inside the write's transaction. */
  readonly write: (
    fields: StoredRow,
    judge: InTransactionRuleJudge | undefined
  ) => Effect.Effect<OutboxedWrite<UpdatedRecord>, E, R | RD>
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

const tableOf = ({ app, tableName }: UpdateScope) => findTableByName(app.tables, tableName)

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

/** Whether a live (not paused) record-update automation targets this table. */
export function hasArmedUpdateTrigger(
  { app, tableName }: UpdateScope,
  pausedNames: ReadonlySet<string>
): boolean {
  return (app.automations ?? []).some(
    (automation) =>
      isAutomationOperationallyEnabled(automation, pausedNames) &&
      triggersOfType(automation, 'record').some(
        (trigger) => trigger.table === tableName && trigger.events.includes('update')
      )
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
  input: Pick<RecordUpdateInput, 'app' | 'tableName' | 'fields' | 'isSqlite' | 'requester'> & {
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
    const judge = yield* steps.authorizeRules(previous, input.fields)
    const published = applyPublishedAtConvention(input, previous, input.fields, input.nowIso)
    const fields = mergeAiBaseline(input, published, previous, input.isSqlite)
    // A run reads the links as they stood, so they are read before the write.
    const before =
      armed && previous !== undefined ? yield* steps.readPreviousLinks(previous) : previous
    const written = yield* steps.write(fields, judge)
    const updated = written.value
    if (armed) {
      yield* steps.dispatchAutomations({
        app,
        tableName,
        event: 'update',
        record: isWritten(updated) ? storedRowOf(updated) : {},
        ...(before === undefined ? {} : { previousRecord: { ...before } }),
        userId: input.userId,
        ...(input.requester === undefined ? {} : { requester: input.requester }),
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

/** What an update fails with: the read's and the write's own errors, and a business rule's refusal. */
type UpdateError =
  | Effect.Error<ReturnType<typeof readReplacedRow>>
  | Effect.Error<ReturnType<typeof updateRecordProgram>>
  | Effect.Error<ReturnType<typeof refuseUnderRules>>

/** What the update's own steps run on — the automations' dispatch aside. */
type UpdateRequirements =
  | Effect.Services<ReturnType<typeof readReplacedRow>>
  | Effect.Services<ReturnType<ReturnType<typeof readPreviousLinkLists>>>
  | Effect.Services<ReturnType<typeof updateRecordProgram>>
  | Effect.Services<typeof loadPausedAutomationNames>
  | Effect.Services<ReturnType<typeof signalAiComputeWritePhase>>
  | AutomationFiberBridge
  | Effect.Services<ReturnType<typeof prepareRuleJudge>>
  | StorageService

/**
 * The rules' step of an update: the row as it stood and the change as sent,
 * the caller's role read against `exemptRoles`; the same rules then go to the
 * write. A row that does not exist is left to the write (not found).
 */
const updateRulesStep =
  (input: RecordUpdateInput) => (previous: StoredRow | undefined, fields: StoredRow) =>
    prepareRuleJudge(
      {
        ...{ app: input.app, tableName: input.tableName, userId: input.session.userId },
        ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
        ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
      },
      (rows) => {
        const existing = rows.get(input.recordId)
        return existing === undefined ? [] : [{ op: 'update', existing, change: fields }]
      }
    ).pipe(
      Effect.tap((judge) => refuseUnderRules(judge, judgedRowsOf(input.recordId, previous))),
      Effect.withSpan('tables.update-rules-step', { attributes: { tableName: input.tableName } })
    )

/**
 * One update with every side effect it carries, its record automations started by
 * `dispatchAutomations`: the records API's own dispatch for every road but an
 * automation step, which hands its run's record-event channel (see
 * `record-write-roads.ts`). Its values pass the rules every record write obeys
 * first (`record-write-values.ts`): a `rich-text` value is stored cleaned, a
 * malformed `email` or `url` refuses the update before the row is read. Fails
 * with that refusal or the write's own errors.
 */
export function updateRecordVia<RA>(
  input: RecordUpdateInput,
  dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
) {
  return checkedWriteValues(input.app, input.tableName, input.fields).pipe(
    Effect.flatMap((fields) => updateCheckedRecord({ ...input, fields }, dispatchAutomations)),
    Effect.withSpan('tables.update-record-via', { attributes: { tableName: input.tableName } })
  )
}

/** {@link updateRecordVia} once its values passed the write value rules. */
function updateCheckedRecord<RA>(
  input: RecordUpdateInput,
  dispatchAutomations: (input: TriggerRecordEventInput) => Effect.Effect<void, never, RA>
) {
  const { session, app, tableName, recordId } = input
  return orchestrateRecordUpdate<UpdateError, UpdateRequirements, RecordWebhookDispatcher, RA>(
    { ...input, userId: session.userId, nowIso: new Date().toISOString() },
    {
      loadPausedNames: loadPausedAutomationNames,
      readRow: readReplacedRow(input),
      readPreviousLinks: readPreviousLinkLists(input),
      authorizeRules: updateRulesStep(input),
      write: (fields, judge) =>
        updateRecordProgram(session, tableName, recordId, {
          ...{ fields, app, judge },
          ...(input.userRole === undefined ? {} : { userRole: input.userRole }),
          ...(input.userGroups === undefined ? {} : { userGroups: input.userGroups }),
          ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
          ...(input.expectedUpdatedAt === undefined
            ? {}
            : { expectedUpdatedAt: input.expectedUpdatedAt }),
          ...(input.auditContext === undefined ? {} : { auditContext: input.auditContext }),
          ...(input.linkLists === undefined ? {} : { linkLists: input.linkLists }),
          ...(input.origin === undefined ? {} : { origin: input.origin }),
        }).pipe(withRecordWebhooks(app, tableName)),
      dispatchAutomations,
      deliverWebhooks: (deliveryIds) => deliverRecordWebhooks(app, deliveryIds, input.deliveryMode),
      // In the tracked background: the enqueue and its status writes outlive
      // the request, drain with the server, and read the same `AiService` this
      // program was provided.
      signalAiCompute: (record, old) =>
        startInTrackedBackground(
          signalAiComputeWritePhase({
            app,
            tableName,
            op: 'update',
            recordId,
            incoming: input.fields,
            old,
            record,
          })
        ),
      deleteAttachments: (refs) =>
        input.replacedAttachments === 'keep'
          ? Effect.void
          : deleteStoredFiles(refs, input.forgetDerivedVariants),
    }
  ).pipe(Effect.withSpan('tables.update-record-with-side-effects', { attributes: { tableName } }))
}
