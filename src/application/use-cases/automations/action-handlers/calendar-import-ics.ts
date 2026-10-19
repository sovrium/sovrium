/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `calendar/importIcs` — read an iCalendar feed and keep a table in step with
 * it, one row per event, matched on the event's `UID`.
 *
 * The feed is fetched through the outbound guard every `http/*` step uses. Its
 * events are mapped to row values (`import-ics-service.ts`), the rows already
 * holding an event's UID are read in ONE query, and only the events whose row
 * is missing or differs are written — each through `batchUpsert`'s per-item
 * road, so the caller gate, the table's webhooks and its record automations
 * (under the record-event depth limit) apply exactly as to any record write.
 * A row equal to its event is not written at all. Nothing is ever deleted.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { readICalendar, type IcsReadEvent } from '@/domain/kernel/format/icalendar-reader'
import { HTTP_REQUEST_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import {
  eventRowValues,
  importSkipReason,
  resolveImportMap,
  rowHoldsValues,
  type ImportIcsMap,
} from '@/domain/models/app/automations/actions/calendar/import-ics-service'
import { guardedFetch, guardedText } from '@/infrastructure/egress/guarded-fetch'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { buildGuestSession } from '../build-guest-session'
import { blockedRequestFailure, httpStatusFailure, requestFailure } from './http-failure'
import { asRecord, resolvedProps, upsertItem, type GateRequirements } from './record-batch'
import { errorMessageOf } from './record-filters'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { App, Table } from '@/domain/models/app'

/** More events than this fails the step before any write. */
const MAX_FEED_EVENTS = 5000

/** The bytes of a feed read: 5 000 events at about 1 KiB each, with room. */
const FEED_BODY_CAP = 10 * 1024 * 1024

/** A `webcal://` address is the same feed over HTTPS. */
const fetchableUrl = (url: string): string => url.trim().replace(/^webcal:\/\//i, 'https://')

/** The feed's body, or the outcome failing the step. */
const fetchFeed = async (url: string): Promise<{ readonly body: string } | ActionOutcome> => {
  try {
    const sent = await guardedFetch(
      url,
      { method: 'GET', headers: { Accept: 'text/calendar, */*;q=0.5' } },
      { timeoutMs: HTTP_REQUEST_TIMEOUT_MS, maxBodyBytes: FEED_BODY_CAP }
    )
    if (!sent.ok) {
      return blockedRequestFailure(
        `The feed address is not allowed by the outbound guard (${sent.reason}): ${sent.message}`
      )
    }
    const body = guardedText(sent.response)
    if (!sent.response.ok) return httpStatusFailure(sent.response.status, body, {})
    if (sent.response.truncated) {
      return { status: 'failure', error: `The feed is larger than ${FEED_BODY_CAP} bytes` }
    }
    return { body }
  } catch (error) {
    return requestFailure(error)
  }
}

interface ImportPlan {
  readonly table: Table
  readonly matchField: string
  readonly map: ImportIcsMap
}

/** One event to write, with the values its row takes. */
interface PendingRow {
  readonly uid: string
  readonly values: Readonly<Record<string, string | undefined>>
}

/** The rows already holding one of `uids`, by their match value. */
const storedRowsByUid = (
  tableName: string,
  matchField: string,
  uids: readonly string[]
): Effect.Effect<
  ReadonlyMap<string, Readonly<Record<string, unknown>>>,
  unknown,
  TableRepository
> =>
  Effect.gen(function* () {
    if (uids.length === 0) return new Map()
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session: buildGuestSession(),
      tableName,
      filter: { and: [{ field: matchField, operator: 'in', value: [...uids] }] },
      limit: uids.length * 2 + 1,
    })
    return new Map(rows.map((row) => [String(row[matchField]), row] as const))
  }).pipe(Effect.withSpan('automations.calendar-import-stored-rows'))

/** The events to import, deduplicated on UID (the first wins), with their values. */
const rowsToImport = (
  events: readonly IcsReadEvent[],
  plan: ImportPlan
): { readonly rows: readonly PendingRow[]; readonly skipped: number } => {
  const kept = events.filter((event) => importSkipReason(event, plan.map) === undefined)
  const uidOf = (event: IcsReadEvent): string => (event.uid ?? '').trim()
  // Read last to first, so the FIRST event bearing a UID is the one the map keeps.
  const firstIndexByUid = new Map(
    kept.map((event, index) => [uidOf(event), index] as const).toReversed()
  )
  const rows = kept.flatMap((event, index) =>
    firstIndexByUid.get(uidOf(event)) === index
      ? [{ uid: uidOf(event), values: eventRowValues(event, plan.map, plan.table) }]
      : []
  )
  // A second event with a UID already kept (not an occurrence override) is skipped too.
  return { rows, skipped: events.length - rows.length }
}

interface WriteTally {
  readonly created: number
  readonly updated: number
  readonly error?: string
}

/** Write the changed and new rows one by one, stopping at the first that fails. */
const writeRows = (input: {
  readonly rows: readonly PendingRow[]
  readonly plan: ImportPlan
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}) =>
  Effect.reduce(
    input.rows,
    (): WriteTally => ({ created: 0, updated: 0 }),
    (tally, row): Effect.Effect<WriteTally, never, GateRequirements> =>
      tally.error !== undefined
        ? Effect.succeed(tally)
        : upsertItem({
            // An event that no longer carries a mapped property clears its field.
            item: {
              ...Object.fromEntries(
                Object.entries(row.values).map(([field, value]) => [field, value ?? null])
              ),
              [input.plan.matchField]: row.uid,
            },
            tableName: input.plan.table.name,
            matchField: input.plan.matchField,
            app: input.app,
            automation: input.automation,
            runContext: input.runContext,
          }).pipe(
            Effect.map((result) => {
              if (result.kind === 'created') return { ...tally, created: tally.created + 1 }
              if (result.kind === 'updated') return { ...tally, updated: tally.updated + 1 }
              return { ...tally, error: `Event '${row.uid}': ${result.error}` }
            })
          )
  )

/** The plan for a step, or the reason it cannot run. */
const planOf = (app: App, props: Readonly<Record<string, unknown>>): ImportPlan | string => {
  const tableName = stringProp(props, 'table')
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return `calendar.importIcs: table '${tableName}' does not exist`
  const matchField = stringProp(props, 'matchField')
  if (matchField === '') return 'calendar.importIcs requires a matchField'
  return { table, matchField, map: resolveImportMap(table, asRecord(props['map'])) }
}

/** Import the events read from the feed: write what changed, report what happened. */
const importEvents = (input: {
  readonly events: readonly IcsReadEvent[]
  readonly malformed: number
  readonly plan: ImportPlan
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<ActionOutcome, never, GateRequirements> =>
  Effect.gen(function* () {
    const { events, malformed, plan } = input
    const { rows, skipped } = rowsToImport(events, plan)
    const uids = rows.map((row) => row.uid)
    const stored = yield* Effect.result(storedRowsByUid(plan.table.name, plan.matchField, uids))
    if (stored._tag === 'Failure') {
      return { status: 'failure', error: errorMessageOf(stored.failure) } as const
    }
    const changed = rows.filter((row) => {
      const existing = stored.success.get(row.uid)
      return existing === undefined || !rowHoldsValues(existing, row.values, plan.table)
    })
    const tally = yield* writeRows({ ...input, rows: changed })
    const output = {
      created: tally.created,
      updated: tally.updated,
      unchanged: rows.length - changed.length,
      skipped: skipped + malformed,
      total: events.length + malformed,
    }
    return tally.error === undefined
      ? ({ status: 'success', output } as const)
      : ({ status: 'failure', error: tally.error, output } as const)
  }).pipe(Effect.withSpan('automations.calendar-import-events'))

export const handleCalendarImportIcs: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = resolvedProps(action, runContext)
    const url = fetchableUrl(stringProp(props, 'url'))
    if (url === '')
      return { status: 'failure', error: 'calendar.importIcs requires a url' } as const
    const plan = planOf(app, props)
    if (typeof plan === 'string') return { status: 'failure', error: plan } as const

    // effect-promise: total -- `fetchFeed` catches every rejection and returns it as a failure outcome.
    const fetched = yield* Effect.promise(() => fetchFeed(url))
    if (!('body' in fetched)) return fetched
    const read = readICalendar(fetched.body, { defaultTimeZone: resolveOperatorTimezone() })
    if (!read.ok) {
      return { status: 'failure', error: 'The feed is not an iCalendar calendar' } as const
    }
    if (read.events.length > MAX_FEED_EVENTS) {
      return {
        status: 'failure',
        error: `The feed holds ${read.events.length} events; at most ${MAX_FEED_EVENTS} are imported`,
      } as const
    }
    return yield* importEvents({ ...read, plan, app, automation, runContext })
  }).pipe(
    Effect.withSpan('automations.handle-calendar-import-ics', {
      attributes: actionAttributes(action),
    })
  )
