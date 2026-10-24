/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { filterChangesReadableByAny } from '@/domain/models/app/tables/field-read-filter-service'
import { callersOfRow } from '@/domain/models/app/tables/row-read-admission-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { admissionOf, planTables, readableRecordIds, REFUSED } from './activity-table-plan'
import { checkRecordReadGateFor } from './record-read-gate'
import type { ActivityTableAdmission } from '@/application/ports/repositories/analytics/activity-log-repository'
import type { ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The activity feed shows a reader only what the records API would show her.
 *
 * An entry IS a record's values at a moment, so it is gated exactly as a read
 * of that record (`checkRecordReadGate`): the table's read grant, then its
 * row-level read rule judged on the record as it stands. A table the app no
 * longer declares admits nobody but an admin. Its `changes` keep only the
 * fields the reader may read, and another actor is named by id and name —
 * her email stays on admin surfaces. A reader's OWN email stays on her own
 * entries.
 *
 * The agent `entries` follow one audience rule. An admin reads them all. A
 * non-admin reads an approval decision she made herself, or one made on a run
 * she started — both judged by her account id, never her role or email. She
 * reads an agent action as she would read its target record: the records read
 * gate of its table and row, or of its table alone when the action kept no
 * row id; an action touching no table only when she started its run.
 *
 * COST. A feed names every record of the last year, so the list never judges
 * record by record: each table's gate is resolved ONCE per request (grant and
 * the caller's projected row rule), and the rule is judged by the database in
 * the statement that pages and counts the entries — a fixed number of
 * statements per table, whatever the number of records.
 *
 * Every function reads the caller from the context `enrichUserRole` filled.
 */

/** The part of an activity entry the gate judges. */
interface GatedEntry {
  readonly tableName: string
  readonly recordId: string
}

/** The actor shape an entry names, before projection. */
interface EntryActor {
  readonly id: string
  readonly name: string
  readonly email: string
}

/** The actor as a non-admin reads another user: no email. */
interface PublicActor {
  readonly id: string
  readonly name: string
}

/**
 * `true` when the caller is admin-equivalent — the built-in `admin` or the
 * app's top role, the one predicate every admin door asks — for whom the feed
 * is whole.
 */
export function readerIsAdmin(c: Context, app: App): boolean {
  return isAdminEquivalent(getTableContext(c).userRole, app)
}

/**
 * The rows of `tableName` the caller reads and the grants that open them, read
 * once for a request that both admits an entry and projects its changes.
 * `undefined` when her grants could not be read: each step then reads alone.
 */
export async function entryReaderRows(
  c: Context,
  app: App,
  tableName: string
): Promise<ReaderRows | undefined> {
  const { session, userRole, userGroups } = getTableContext(c)
  const reader = { session, role: userRole, groups: userGroups }
  const rows = await runOnRequest(c, readerRowsOf(app, tableName, reader))
  return rows._tag === 'Success' ? rows.success : undefined
}

/**
 * Whether the caller may read the record an entry was written on. `rows`, when
 * this request already read them, spares a second read of her grants.
 */
export async function admitsActivityEntry(
  c: Context,
  app: App,
  entry: GatedEntry,
  rows?: ReaderRows
): Promise<boolean> {
  if (readerIsAdmin(c, app)) return true
  const table = app.tables?.find((t) => t.name === entry.tableName)
  if (!table) return false
  return (
    (await checkRecordReadGateFor(c, app, table, { recordId: entry.recordId, rows })) === undefined
  )
}

/**
 * What of the activity list the caller reads: `everything` for an admin, else
 * the tables (and, under a row-level read rule, the rows) the records API lets
 * her read — each table's gate resolved once, the rows judged by the database
 * in the statement that pages them, so the page and its total count admitted
 * entries only. `tableName` narrows the tables planned to the one filtered on.
 */
export async function activityAdmission(
  c: Context,
  app: App,
  tableName: string | undefined
): Promise<'everything' | readonly ActivityTableAdmission[]> {
  if (readerIsAdmin(c, app)) return 'everything'
  const names = (app.tables ?? [])
    .map((table) => table.name)
    .filter((name) => tableName === undefined || name === tableName)
  const plans = await planTables(c, app, names)
  return [...plans].reduce<Promise<readonly ActivityTableAdmission[]>>(
    async (done, [name, plan]) => [...(await done), ...(await admissionOf(c, name, plan))],
    Promise.resolve([])
  )
}

/**
 * Name the actor as this caller may see her: whole for an admin or for the
 * caller's own entries, id and name otherwise.
 */
export function projectActivityActor<A extends EntryActor>(
  c: Context,
  app: App,
  actor: A | null
): A | PublicActor | null {
  if (actor === null) return null
  if (readerIsAdmin(c, app) || actor.id === getTableContext(c).session.userId) return actor
  return { id: actor.id, name: actor.name }
}

/**
 * An activity `entries` item as this caller may see it: another user's email
 * is dropped for a non-admin, her id (and name, when the entry carries one)
 * kept. An admin, and the caller on her own entries, read it whole. An actor
 * carrying no email — an agent — passes unchanged.
 */
export function projectEntryActor<E extends { readonly actor: object }>(
  c: Context,
  app: App,
  entry: E
): E | (Omit<E, 'actor'> & { readonly actor: Partial<E['actor']> }) {
  const { actor } = entry
  if (readerIsAdmin(c, app) || !('email' in actor)) return entry
  if ('id' in actor && actor.id === getTableContext(c).session.userId) return entry
  const { email: _email, ...withoutEmail } = actor
  return { ...entry, actor: withoutEmail }
}

/**
 * An entry's change set, holding only the fields a list of its row shows the
 * caller: under her role, and each role a grant gives her on that row. `rows`,
 * when this request already read them, spares a second read of her grants.
 */
export async function projectActivityChanges(
  c: Context,
  app: App,
  entry: GatedEntry & { readonly changes: unknown },
  rows?: ReaderRows
): Promise<unknown> {
  const { userRole, userGroups } = getTableContext(c)
  const caller = { role: userRole, groups: userGroups }
  // Without its grants the caller reads under her role alone.
  const grants = (rows ?? (await entryReaderRows(c, app, entry.tableName)))?.grants
  return filterChangesReadableByAny({
    app,
    tableName: entry.tableName,
    callers: callersOfRow(caller, grants, entry.recordId),
    changes: entry.changes,
  })
}

/**
 * An agent `entries` item, as far as the audience rule reads it — a decision
 * (it names its `approvalId`) or an agent action. Structural, so this gate
 * needs nothing of the agents surface that stores them.
 */
type AudienceEntry =
  | {
      readonly approvalId: string
      readonly actor: { readonly id: string }
      readonly runStartedById: string | undefined
    }
  | {
      readonly targetTable: string | undefined
      readonly recordId: string | undefined
      readonly runStartedById: string | undefined
    }

/** The table and row an agent action is judged on, as one memo key. */
const actionKey = (table: string, recordId: string | undefined): string =>
  `${table}\u0000${recordId ?? ''}`

/**
 * Whether the caller may read each agent action, keyed by {@link actionKey}:
 * the records read gate of its table and row — or, for an action that kept no
 * row id, of its table alone, which a row-level read rule holding the caller
 * refuses since no record exists to judge it on. Each table is planned once
 * and its rows judged in one statement.
 */
async function agentActionVerdicts(
  c: Context,
  app: App,
  targets: readonly { readonly table: string; readonly recordId: string | undefined }[]
): Promise<ReadonlyMap<string, boolean>> {
  const plans = await planTables(
    c,
    app,
    targets.map((target) => target.table)
  )
  const readable = await [...plans].reduce<Promise<ReadonlyMap<string, ReadonlySet<string>>>>(
    async (done, [table, plan]) => {
      const ids = targets.flatMap((target) =>
        target.table === table && target.recordId !== undefined ? [target.recordId] : []
      )
      return new Map([...(await done), [table, await readableRecordIds(c, table, plan, ids)]])
    },
    Promise.resolve(new Map())
  )
  return new Map(
    targets.map((target) => {
      const plan = plans.get(target.table) ?? REFUSED
      const admitted =
        target.recordId === undefined
          ? plan.kind === 'all'
          : readable.get(target.table)?.has(target.recordId) === true
      return [actionKey(target.table, target.recordId), admitted] as const
    })
  )
}

/**
 * Keep the agent `entries` this caller may read, in order (the audience rule
 * above). Each table is judged once, however many actions touched it.
 */
export async function filterAudienceEntries<E extends AudienceEntry>(
  c: Context,
  app: App,
  entries: readonly E[]
): Promise<readonly E[]> {
  if (readerIsAdmin(c, app)) return entries
  const callerId = getTableContext(c).session.userId
  const targets = entries.flatMap((entry) =>
    'approvalId' in entry || entry.targetTable === undefined
      ? []
      : [{ table: entry.targetTable, recordId: entry.recordId }]
  )
  const verdicts = await agentActionVerdicts(c, app, targets)
  return entries.filter((entry) => {
    if ('approvalId' in entry) {
      return entry.actor.id === callerId || entry.runStartedById === callerId
    }
    if (entry.targetTable === undefined) return entry.runStartedById === callerId
    return verdicts.get(actionKey(entry.targetTable, entry.recordId)) === true
  })
}

/** An `entries` item as it goes on the wire: who started its run stays here. */
export function toWireEntry<E extends AudienceEntry>(entry: E): Omit<E, 'runStartedById'> {
  const { runStartedById: _startedBy, ...wire } = entry
  return wire
}
