/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's calendar feed (`tables[].calendarFeed`): the private address each
 * reader mints for herself, and the iCalendar body that address answers.
 *
 * ─── THE ADDRESS: 256 BITS, DIGEST AT REST, PLAINTEXT RETURNED ONCE ─────────
 *
 * The pattern `design-system-share.ts` follows: `randomBytes(32)` hex, only its
 * SHA-256 hex digest stored, the plaintext handed back to its owner once and
 * referenced nowhere else — no log line, no audit entry, no span attribute.
 * One live address per person and table: minting again replaces it.
 *
 * ─── THE BODY: READ AS ITS OWNER, AT FETCH TIME ─────────────────────────────
 *
 * A calendar app polls with no cookie. The address names its owner, and the
 * feed is read as her on every poll, through the same no-session read the MCP
 * table tools use (`list-records-as-caller.ts`): her standing (a banned or
 * removed account reads nothing), her table grant, her row-level read rule and
 * her field read permissions, all as they stand now. A row whose start she may
 * not read cannot be placed, so it is left out.
 */

import { createHash, randomBytes } from 'node:crypto'
import { Effect } from 'effect'
import {
  CalendarFeedTokenRepository,
  type CalendarFeedTokenDatabaseError,
  type CalendarFeedTokenRecord,
} from '@/application/ports/repositories/tables/calendar-feed-token-repository'
import { writeICalendar, type IcsWriteEvent } from '@/domain/kernel/format/icalendar'
import { hasReadPermissionForCaller } from '@/domain/models/app/auth/permission-evaluator-service'
import {
  CALENDAR_FEED_MAX_EVENTS,
  rowToCalendarEvent,
  type CalendarFeedRow,
} from '@/domain/models/app/tables/calendar-feed-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { listRecordsAsCaller, synthesizeCallerSession } from './list-records-as-caller'
import { loadCallerIdentity, type CallerIdentity } from './permissions/caller-write-authority'
import { buildReadListFilter } from './permissions/row-level-read-filter'
import type { AiComputeStatusRepository } from '@/application/ports/repositories/ai/ai-compute-status-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

/** A fresh 256-bit (64 hex char) cryptographically random token. */
const generateToken = (): string => randomBytes(32).toString('hex')

/** SHA-256 hex digest of a plaintext token. */
const digestOf = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex')

/** A string that could be a minted token: 64 lower-case hex characters. */
const TOKEN_SHAPE = /^[0-9a-f]{64}$/

/** The path a minted token is read at, relative to the instance root. */
export const calendarFeedPath = (tableName: string, token: string): string =>
  `/api/tables/${encodeURIComponent(tableName)}/calendar-feed/${token}.ics`

type ReaderRequirements = AuthRepository | DataSourceRepository | TableRepository

/** A table that publishes a feed, by name. */
const feedTableOf = (app: App, tableName: string): Table | undefined => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  return table?.calendarFeed === undefined ? undefined : table
}

/** Who the person is, when she may read the table at all. */
const readerOf = (
  app: App,
  table: Table,
  userId: string
): Effect.Effect<CallerIdentity | undefined, never, ReaderRequirements> =>
  loadCallerIdentity(app, userId, table).pipe(
    Effect.map((identity) =>
      identity !== undefined &&
      hasReadPermissionForCaller(
        table,
        { effectiveRoles: identity.effectiveRoles, signedOut: false },
        app
      )
        ? identity
        : undefined
    )
  )

/**
 * Whether `userId` may hold a feed address for `tableName`: the table declares
 * a feed and she may read it. `false` covers a missing table, a table without a
 * feed and a table she may not read alike — one 404 for all three.
 */
export const mayHoldCalendarFeed = (
  app: App,
  userId: string,
  tableName: string
): Effect.Effect<boolean, never, ReaderRequirements> =>
  Effect.gen(function* () {
    const table = feedTableOf(app, tableName)
    if (table === undefined) return false
    return (yield* readerOf(app, table, userId)) !== undefined
  }).pipe(Effect.withSpan('tables.may-hold-calendar-feed'))

/** What a mint returns: the plaintext the owner is shown once, and when it was made. */
export interface MintedCalendarFeed {
  readonly token: string
  readonly createdAt: Date
}

/** Mint (or replace) the person's address for the table. */
export const mintCalendarFeedToken = (
  userId: string,
  tableName: string
): Effect.Effect<MintedCalendarFeed, CalendarFeedTokenDatabaseError, CalendarFeedTokenRepository> =>
  Effect.gen(function* () {
    const repository = yield* CalendarFeedTokenRepository
    const token = generateToken()
    const stored = yield* repository.replace({ userId, tableName, tokenDigest: digestOf(token) })
    return { token, createdAt: stored.createdAt }
  }).pipe(Effect.withSpan('tables.mint-calendar-feed-token'))

/** The person's live address for the table — its metadata, never the token. */
export const readCalendarFeedToken = (
  userId: string,
  tableName: string
): Effect.Effect<
  CalendarFeedTokenRecord | undefined,
  CalendarFeedTokenDatabaseError,
  CalendarFeedTokenRepository
> =>
  Effect.gen(function* () {
    const repository = yield* CalendarFeedTokenRepository
    return yield* repository.find(userId, tableName)
  }).pipe(Effect.withSpan('tables.read-calendar-feed-token'))

/** Revoke the person's address for the table; `false` when there was none. */
export const revokeCalendarFeedToken = (
  userId: string,
  tableName: string
): Effect.Effect<boolean, CalendarFeedTokenDatabaseError, CalendarFeedTokenRepository> =>
  Effect.gen(function* () {
    const repository = yield* CalendarFeedTokenRepository
    return yield* repository.revoke(userId, tableName)
  }).pipe(Effect.withSpan('tables.revoke-calendar-feed-token'))

/** The names of the tables `app` declares a calendar feed on. */
export const tablesDeclaringFeed = (app: App): ReadonlySet<string> =>
  new Set((app.tables ?? []).filter((table) => table.calendarFeed !== undefined).map((t) => t.name))

/**
 * Delete the addresses of every table `app` no longer publishes — one that no
 * longer declares `calendarFeed`, or that left the config — so declaring the
 * feed again later revives none of them. Run on every config apply; answers the
 * number deleted.
 */
export const purgeCalendarFeedAddresses = (
  app: App
): Effect.Effect<number, CalendarFeedTokenDatabaseError, CalendarFeedTokenRepository> =>
  Effect.gen(function* () {
    const repository = yield* CalendarFeedTokenRepository
    return yield* repository.purgeTablesWithoutFeed(tablesDeclaringFeed(app))
  }).pipe(Effect.withSpan('tables.purge-calendar-feed-addresses'))

/** How the sessions a feed read synthesises are named. */
const FEED_SESSION_LABEL = { id: 'calendar-feed-session', token: 'calendar-feed' } as const

/**
 * The rows the reader may place on her calendar, latest-starting first, or
 * `undefined` when the list refuses her the table, as the records API does
 * when no row of it is hers to read.
 */
const readFeedRows = (
  app: App,
  table: Table,
  reader: { readonly userId: string; readonly identity: CallerIdentity }
): Effect.Effect<
  readonly CalendarFeedRow[] | undefined,
  DatabaseError,
  ReaderRequirements | AiComputeStatusRepository
> =>
  Effect.gen(function* () {
    const feed = table.calendarFeed
    if (feed === undefined) return []
    const { identity } = reader
    const caller = { role: identity.role, groups: identity.groups }
    // A start she may not read cannot place a row: every row is left out.
    if (!isFieldReadableByCaller(app, table.name, caller, feed.start)) return []
    const rowFilter = buildReadListFilter(table, identity.ctx)
    if (rowFilter === 'empty' || rowFilter === 'reject') return []
    const page = yield* listRecordsAsCaller({
      app,
      tableName: table.name,
      session: synthesizeCallerSession(reader.userId, FEED_SESSION_LABEL),
      role: identity.role,
      groups: identity.groups,
      rowFilter,
      clauses: [{ field: feed.start, operator: 'isNotEmpty', value: null }],
      sort: `${feed.start}:desc`,
      limit: CALENDAR_FEED_MAX_EVENTS,
    }).pipe(Effect.catchTag('NotFoundError', () => Effect.void))
    if (page === undefined) return undefined
    return page.records.map((record) => ({
      id: String(record.id),
      fields: record.fields as Readonly<Record<string, unknown>>,
      updatedAt: record.updatedAt,
    }))
  })

/** The events `rows` stand for, on the calendar of `table`. */
const eventsOf = (
  table: Table,
  rows: readonly CalendarFeedRow[],
  host: string
): readonly IcsWriteEvent[] => {
  const feed = table.calendarFeed
  if (feed === undefined) return []
  const startKind =
    table.fields.find((field) => field.name === feed.start)?.type === 'date' ? 'date' : 'datetime'
  return rows.flatMap((row) => {
    const event = rowToCalendarEvent({ row, feed, startKind, tableName: table.name, host })
    return event === undefined ? [] : [event]
  })
}

/**
 * The iCalendar body the address `token` answers for `tableName`, or
 * `undefined` for every way it may not be read: a string that is not a token,
 * an unknown, replaced or revoked one, one minted for another table, a table
 * whose config no longer declares a feed, and an owner who is banned or removed,
 * or may not read the table now. One answer, so the route has one 404.
 */
export const readCalendarFeed = (input: {
  readonly app: App
  readonly tableName: string
  readonly token: string
  readonly host: string
}): Effect.Effect<
  string | undefined,
  CalendarFeedTokenDatabaseError | DatabaseError,
  CalendarFeedTokenRepository | ReaderRequirements | AiComputeStatusRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, token, host } = input
    const table = feedTableOf(app, tableName)
    if (table?.calendarFeed === undefined || !TOKEN_SHAPE.test(token)) return undefined
    const repository = yield* CalendarFeedTokenRepository
    const address = yield* repository.findByDigest(digestOf(token))
    if (address === undefined || address.tableName !== tableName) return undefined
    const identity = yield* readerOf(app, table, address.userId)
    if (identity === undefined) return undefined
    const rows = yield* readFeedRows(app, table, { userId: address.userId, identity })
    if (rows === undefined) return undefined
    return writeICalendar({
      name: table.labelPlural ?? table.label ?? table.name,
      events: eventsOf(table, rows, host),
    })
  }).pipe(
    Effect.withSpan('tables.read-calendar-feed', { attributes: { 'table.name': input.tableName } })
  )
