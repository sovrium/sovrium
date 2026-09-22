/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the console landing page's ATTENTION read
 * (`GET /api/admin/attention`) — the companion of `buildAdminOverview`.
 *
 * The overview answers *"how big is this instance?"* with one headline scalar
 * per domain. This answers *"what is wrong with it right now?"* with the six
 * pulse cells the landing page renders above its tile grid, plus the per-tile
 * SUB-LINE figures the same page renders under each headline number.
 *
 * Every figure here is a LIST REDUCTION over an existing admin read — a count
 * of failing runs by automation, of required-but-unset variables, of expired
 * connections. That is the whole reason the endpoint exists rather than the
 * page binding nine `kpi` islands: a declarative config layer can bind a
 * scalar, and none of these is one until something reduces a list to it.
 *
 * ─── TWO CLASSES OF CELL, AND ONLY ONE IS WINDOWED ──────────────────────────
 *
 * `failedRuns` and `recentSubmissions` are EVENT counts: they count rows
 * created after `since`, and a restart resets them to `0`. The other four are
 * STATE counts: they report what is true NOW, and a restart does not reset
 * them. An automation paused last week is still paused and must still be
 * reported, so there is deliberately no `created_at > since` predicate on
 * `variablesUnset`, `tokensExpired`, `invitationsPending` or
 * `automationsPaused` — one would hide exactly the long-standing problems the
 * strip exists to surface.
 *
 * ─── A DEGRADED SOURCE IS NOT A ZERO ────────────────────────────────────────
 *
 * The sibling roll-up learned this the expensive way: a `0` emitted because a
 * source could not be read is indistinguishable from a `0` emitted because
 * there is genuinely nothing wrong, and the operator reads calm where the
 * truth is an outage. The flat body has nowhere to put a per-cell marker, so
 * each block that reads a source returns its own {@link Sourced} envelope
 * naming itself on failure, and the names are joined into the response's
 * single `degraded` field. A degraded cell still emits `0` with an EMPTY
 * detail, so the `count 0 ⟺ detail ''` contract stays single-meaning and
 * `degraded` is the ONE channel that says a figure was not measured.
 *
 * Resilience is on BOTH axes, as it is on the overview: `Effect.tapCause` then
 * `orElseSucceed` rescues a source that FAILS, and `withBlockTimeout` rescues
 * one that is merely slow — a tile is never an operator error, and never a
 * 504 either.
 *
 * @see src/application/use-cases/admin/overview.ts (the sibling headline roll-up)
 * @see src/domain/models/api/admin/overview/attention.ts (the wire contract)
 */

import { Cause, Data, Effect } from 'effect'
import { AdminAutomationsRepository } from '@/application/ports/repositories/automations/admin-automations-repository'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import { UsersDirectoryRepository } from '@/application/ports/repositories/tables/users-directory-repository'
import { BuildAutomationsCatalog } from '@/application/use-cases/admin/automations-catalog'
import { buildEnvVarStatuses } from '@/application/use-cases/admin/config/env-status'
import { BuildConnectionsList } from '@/application/use-cases/admin/connections'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { listInvitations } from '@/application/use-cases/auth/admin-invitation-lifecycle'
import { buildCatalog } from '@/application/use-cases/links/catalog'
import { configSlugs } from '@/application/use-cases/links/config-slugs'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { Logger } from '@/infrastructure/logging/logger'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import type { AdminAttentionResponse } from '@/domain/models/api/admin/overview/attention'
import type { App } from '@/domain/models/app'

/**
 * Every port the blocks below read, as one name.
 *
 * Stated once rather than repeated on {@link buildAdminAttention}'s signature:
 * the report's requirement IS the union of its blocks', and writing it out
 * twice is how the two drift. All of them are carried by the server runtime,
 * so the route discharges the whole set with a single `provideDomain`.
 */
export type AdminAttentionServices =
  // The blocks log their own degradation through the service rather than the
  // bare sink, so a test can assert on the reason a cell went grey instead of
  // reading stdout.
  | Logger
  | AdminAutomationsRepository
  | AutomationPauseRepository
  | AutomationRunRepository
  | AdminFormsRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | OAuthStateStore
  | LinkRepository
  | AnalyticsRepository
  | UsersDirectoryRepository

/**
 * A block's result, carrying the name of the source when it could NOT be read.
 *
 * `source` is `undefined` on the healthy path and a short human name
 * (`'connections'`, `'invitations'`) on the degraded one. It is spelled as a
 * required key holding `string | undefined` rather than an optional key so a
 * block cannot forget to answer the question — the whole point of the envelope
 * is that "was this measured?" is never left implicit.
 */
interface Sourced<A> {
  readonly value: A
  readonly source: string | undefined
}

/** The healthy spelling: a measured value, no source to distrust. */
const measured = <A>(value: A): Sourced<A> => ({ value, source: undefined })

/** The fallback spelling: the zero value, and the name of what failed. */
const unread = <A>(value: A, source: string): Sourced<A> => ({ value, source })

/** A cell's count and the rendered sub-line naming the subjects behind it. */
interface Cell {
  readonly count: number
  readonly detail: string
}

/** The zero cell: no count, and therefore no subjects to name. */
const EMPTY_CELL: Cell = { count: 0, detail: '' }

/** The separator every rendered detail joins its subjects with. */
const DETAIL_SEPARATOR = ' · '

/**
 * How many subjects a detail may name before it summarises the remainder.
 *
 * Formatting server-side is what bounds the body (a thousand failed runs still
 * produce one short line), and this is the bound. Four fits the strip's cell
 * width at the console's narrowest supported viewport; beyond that the line
 * would be truncated by CSS, which tells the operator less than `+N more` does.
 */
const MAX_DETAIL_SUBJECTS = 4

/**
 * Render a subject list into a cell's sub-line, summarising the overflow.
 *
 * An empty list renders the empty string, which is exactly the contract's zero
 * spelling — so a caller never has to special-case the cold path.
 */
const renderDetail = (subjects: readonly string[]): string => {
  if (subjects.length <= MAX_DETAIL_SUBJECTS) return subjects.join(DETAIL_SEPARATOR)
  const shown = subjects.slice(0, MAX_DETAIL_SUBJECTS)
  return [...shown, `+${subjects.length - MAX_DETAIL_SUBJECTS} more`].join(DETAIL_SEPARATOR)
}

/**
 * Build a cell from the subjects behind it, keeping count and detail paired.
 *
 * The pairing contract (`count 0 ⟺ detail ''`) is a structural property of
 * this function rather than a rule each block has to remember: the count IS
 * the subject count, so a non-zero cell always names at least one subject and
 * a zero cell can never name one.
 */
const cellOf = (subjects: readonly string[]): Cell => ({
  count: subjects.length,
  detail: renderDetail(subjects),
})

/**
 * Group names into `name ×N` subjects, heaviest first.
 *
 * Used by the two cells whose subjects repeat — a failing automation fails
 * many times, one form receives many submissions — so the operator reads
 * "deal-won-invoice ×7" rather than the same name seven times.
 */
const tallySubjects = (names: readonly string[]): readonly string[] =>
  [...new Set(names)]
    .map((name) => ({ name, count: names.filter((candidate) => candidate === name).length }))
    .toSorted((a, b) => (a.count === b.count ? a.name.localeCompare(b.name) : b.count - a.count))
    .map(({ name, count }) => `${name} ×${count}`)

/**
 * A tallied cell whose COUNT is the number of events, not of distinct names.
 *
 * `cellOf` cannot serve here: it derives the count from the subject list, and
 * the subject list has been collapsed by {@link tallySubjects}. Two failures
 * of one automation are two failed runs and one subject.
 */
const tallyCell = (names: readonly string[]): Cell => ({
  count: names.length,
  detail: renderDetail(tallySubjects(names)),
})

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Render an instant as a compact UTC stamp (`9 Sep 16:20`).
 *
 * Built from the date parts rather than through `toLocaleString`, because the
 * detail is a byte-compared contract value and ICU output varies with the
 * runtime's locale data. UTC rather than a server-local zone for the same
 * reason: the console has no operator timezone to render in, and a stamp that
 * silently followed the host's would disagree with every other timestamp on
 * the surface.
 */
const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatStamp = (iso: string): string => {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'an unknown time'
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()] ?? '???'} ${pad2(at.getUTCHours())}:${pad2(at.getUTCMinutes())}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Render how long the oldest of a set has been waiting, in whole days. */
const formatWaited = (oldestIso: string, nowMs: number): string => {
  const at = Date.parse(oldestIso)
  if (Number.isNaN(at)) return 'oldest waiting'
  const days = Math.floor(Math.max(0, nowMs - at) / DAY_MS)
  if (days === 0) return 'oldest today'
  return days === 1 ? 'oldest 1 day' : `oldest ${days} days`
}

/**
 * Record WHY a block degraded, then fall back to its unread envelope.
 *
 * `Effect.tapCause` runs AHEAD of the fallback and preserves the cause, so the
 * block still cannot fail while the reason survives — defects and
 * interruptions included, which a failure-only tap would drop. Placement is
 * load-bearing: a tap after the swallow observes nothing (E6).
 */
const degradeTo = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  source: string,
  zero: A
): Effect.Effect<Sourced<A>, never, R | Logger> =>
  effect.pipe(
    Effect.map(measured),
    Effect.tapCause((cause: Cause.Cause<E>) =>
      Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.error(
          `Admin attention source '${source}' could not be read; its figures are the zero fallback`,
          Cause.squash(cause),
          { 'sovrium.admin.attention.source': source }
        )
      })
    ),
    Effect.orElseSucceed(() => unread(zero, source))
  )

/**
 * Per-source latency budget (milliseconds).
 *
 * Mirrors the sibling roll-up's reasoning: `orElseSucceed` rescues a source
 * that FAILS but not one that is merely slow, and a slow source would push the
 * whole request past the Hono `API_TIMEOUT_MS` (30s) ceiling into a 504. The
 * sources run concurrently, so 8s is comfortably under that ceiling while
 * still letting a genuinely slow-but-reachable source answer.
 */
const SOURCE_TIMEOUT_MS = 8000

/**
 * How many sources may be read at once.
 *
 * Bounded rather than `'unbounded'` because bun:sql's default pool is small
 * (`DATABASE_POOL_MAX` defaults to 10) and this endpoint is loaded by the same
 * page as the overview roll-up, which has its own budget. Four concurrent
 * sources, one of which (submissions) fans out at `concurrency: 2`, peaks at
 * ~5 connections — leaving headroom for the neighbouring request rather than
 * racing it for the pool.
 */
const SOURCE_CONCURRENCY = 4

/**
 * How many failed runs are scanned to build the `failedRuns` cell.
 *
 * The cell reports a COUNT and names at most {@link MAX_DETAIL_SUBJECTS}
 * automations, so an exact count past this bound buys the operator nothing
 * they would act on differently — "more than 500 runs have failed since boot"
 * and "512 have" prompt the same response. Bounding the scan is what keeps a
 * pathological instance from reading its whole run history into memory to
 * render one line.
 */
const FAILED_RUNS_SCAN_LIMIT = 500

/** The terminal status a run carries when it failed. */
const FAILED_RUN_STATUS = 'failed'

// ─── The six pulse cells ────────────────────────────────────────────────────

/**
 * `failedRuns` — automation runs that ended in failure since `since` (EVENT).
 *
 * Read through `listAdminRuns` rather than the overview's
 * `listOverviewRowsSince`, because the latter projects `{ startedAt, createdAt,
 * status }` and drops the automation NAME — and a count with nothing under it
 * tells the operator where to look precisely nothing.
 */
const failedRunsBlock = (
  since: Readonly<Date>
): Effect.Effect<Sourced<Cell>, never, AdminAutomationsRepository | Logger> =>
  degradeTo(
    Effect.gen(function* () {
      const repo = yield* AdminAutomationsRepository
      const runs = yield* repo.listAdminRuns({
        status: FAILED_RUN_STATUS,
        from: since,
        limit: FAILED_RUNS_SCAN_LIMIT,
      })
      return tallyCell(runs.map((run) => run.automationName))
    }),
    'automation runs',
    EMPTY_CELL
  )

/**
 * `variablesUnset` — declared variables that are required and have no value.
 *
 * PURE: `buildEnvVarStatuses` reduces the app's own declarations against the
 * process environment, so there is no source to be unable to read and this
 * cell can never be degraded.
 *
 * The detail carries variable NAMES and never values (S4). The cell counts
 * variables that are UNSET, so there is no value to leak here — but a later
 * "expiring secret" cell reusing this shape would have one, which is why the
 * rule is stated rather than left to the happy accident.
 */
const variablesUnsetCell = (app: App): Cell =>
  cellOf(
    buildEnvVarStatuses(app, process.env)
      .filter((status) => status.required && !status.isSet)
      .map((status) => status.key)
  )

/**
 * `tokensExpired` — connections whose derived status is `expired` (STATE).
 *
 * `expiring-soon` is deliberately NOT counted: that credential still works,
 * and a cell that conflated the two would cry wolf every time a token entered
 * its renewal window.
 *
 * The detail names the connection and its provider — never the token (S4).
 */
const tokensExpiredBlock = (): Effect.Effect<
  Sourced<Cell>,
  never,
  ConnectionRepository | ConnectionTokenRepository | OAuthStateStore | Logger
> =>
  degradeTo(
    BuildConnectionsList.pipe(
      Effect.map((outcome) =>
        outcome._tag === 'Ok'
          ? cellOf(
              outcome.body.connections
                .filter((connection) => connection.status === 'expired')
                .map((connection) => `${connection.name} · ${connection.provider}`)
            )
          : EMPTY_CELL
      )
    ),
    'connections',
    EMPTY_CELL
  )

/**
 * The invitation ledger could not be read.
 *
 * Tagged rather than a bare `Error` even though {@link degradeTo} swallows it
 * two lines later (E2/E4): an untagged error merges with every other untagged
 * error in the failure channel, so the day a second promise-shaped source joins
 * this block the two become indistinguishable to a `catchTag` that wants to
 * treat them differently. The original is preserved in `cause`, which is what
 * the degradation log prints.
 */
class InvitationsUnreadableError extends Data.TaggedError('InvitationsUnreadableError')<{
  readonly cause: unknown
}> {}

/**
 * `invitationsPending` — invitations still awaiting acceptance (STATE).
 *
 * An EXPIRED invitation is not pending: its link is dead, so nothing is
 * outstanding for the operator to wait on. It is still listed as expired by
 * `GET /api/admin/invitations`, which is where that distinction belongs.
 *
 * The detail reports how long the OLDEST has waited rather than naming the
 * invitees: an invitee address is a person's email, and the strip is a pulse
 * rather than a directory.
 */
const invitationsPendingBlock = (nowMs: number): Effect.Effect<Sourced<Cell>, never, Logger> =>
  degradeTo(
    Effect.tryPromise({
      try: () => listInvitations(),
      catch: (cause) => new InvitationsUnreadableError({ cause }),
    }).pipe(
      Effect.map((invitations) => {
        const pending = invitations.filter((invitation) => invitation.status === 'pending')
        const oldest = pending
          .map((invitation) => invitation.createdAt)
          .toSorted((a, b) => Date.parse(a) - Date.parse(b))
          .at(0)
        if (oldest === undefined) return EMPTY_CELL
        return { count: pending.length, detail: formatWaited(oldest, nowMs) }
      })
    ),
    'invitations',
    EMPTY_CELL
  )

/**
 * `recentSubmissions` — form submissions received since `since` (EVENT).
 *
 * NOT the lifetime figure, which is `GET /api/admin/overview`'s
 * `submissions.total`. The per-form fan-out is bounded (`concurrency: 2`) so a
 * form-heavy app cannot exhaust the connection pool while the other sources
 * read concurrently.
 */
const recentSubmissionsBlock = (
  app: App,
  since: Readonly<Date>
): Effect.Effect<Sourced<Cell>, never, AdminFormsRepository | Logger> => {
  const forms = app.forms ?? []
  return degradeTo(
    Effect.gen(function* () {
      const repo = yield* AdminFormsRepository
      const perForm = yield* Effect.all(
        forms.map((form) =>
          repo
            .listSubmissionsSince(form.name, since)
            .pipe(Effect.map((rows) => rows.map(() => form.name)))
        ),
        { concurrency: 2 }
      )
      return tallyCell(perForm.flat())
    }),
    'form submissions',
    EMPTY_CELL
  )
}

/**
 * The automations catalog, reduced to the two states the strip and the
 * Automations tile report.
 *
 * `paused` and `disabled` come from ONE read of ONE catalog, because
 * `automationsPaused` serves BOTH the sixth pulse cell and the tile's
 * sub-line: two reads would be two chances to disagree on one screen. The two
 * states are disjoint by construction —
 * `resolveAutomationOperationalState` returns exactly one of
 * `active | paused | disabled` per automation.
 */
interface AutomationStates {
  readonly paused: Cell
  readonly disabled: number
}

const AUTOMATION_STATES_ZERO: AutomationStates = { paused: EMPTY_CELL, disabled: 0 }

const automationStatesBlock = (
  app: App
): Effect.Effect<Sourced<AutomationStates>, never, AutomationPauseRepository | Logger> =>
  degradeTo(
    BuildAutomationsCatalog(app).pipe(
      Effect.map((catalog) => ({
        paused: cellOf(
          catalog.items
            .filter((item) => item.state === 'paused')
            .map((item) =>
              item.pausedAt === undefined
                ? item.name
                : `${item.name} · since ${formatStamp(item.pausedAt)}`
            )
        ),
        disabled: catalog.items.filter((item) => item.state === 'disabled').length,
      }))
    ),
    'automations',
    AUTOMATION_STATES_ZERO
  )

// ─── The tile sub-lines ─────────────────────────────────────────────────────

/**
 * `linksConfig` / `linksDb` — the links catalog partitioned by source.
 *
 * Built from the SAME union `GET /api/admin/links` lists (`buildCatalog` over
 * `app.links[]` plus the stored rows, with shadowed rows already folded away),
 * and filtered on the same default `include_archived=false`. That is what
 * makes `linksConfig + linksDb === /api/admin/links`.`total` a structural
 * property rather than a coincidence two reductions have to maintain
 * separately.
 *
 * The per-entry lifecycle STATE is deliberately not resolved: the default
 * catalog query applies no state filter, so resolving states would change
 * nothing about the partition while costing a click-count read per link.
 */
interface LinkSplit {
  readonly config: number
  readonly db: number
}

const LINK_SPLIT_ZERO: LinkSplit = { config: 0, db: 0 }

const linksBlock = (app: App): Effect.Effect<Sourced<LinkSplit>, never, LinkRepository | Logger> =>
  degradeTo(
    Effect.gen(function* () {
      const repository = yield* LinkRepository
      const rows = yield* repository.list({ appName: app.name, includeArchived: false })
      const entries = buildCatalog({ app, rows, claimedSlugs: configSlugs(app) }).filter(
        (entry) => !entry.archived
      )
      return {
        config: entries.filter((entry) => entry.source === 'config').length,
        db: entries.filter((entry) => entry.source === 'db').length,
      }
    }),
    'links',
    LINK_SPLIT_ZERO
  )

/**
 * `usersBanned` — accounts whose ban flag is set.
 *
 * A subset of the Users tile's own headline, never larger: a banned user is
 * still a user. Read through the directory port, which already excludes
 * agent-mirrored accounts (an agent is not a person) — so the subset relation
 * holds against the figure the tile above it shows.
 */
const usersBannedBlock = (): Effect.Effect<
  Sourced<number>,
  never,
  UsersDirectoryRepository | Logger
> =>
  degradeTo(
    Effect.gen(function* () {
      const repository = yield* UsersDirectoryRepository
      const rows = yield* repository.listAllUsers()
      return rows.filter((row) => row.banned === true).length
    }),
    'users',
    0
  )

/**
 * `tableFields` — declared fields summed across every configured table.
 *
 * Config-derived and therefore exact: this is a reduction over `app.tables[]`,
 * not a count of physical columns, so it matches what the operator reads in
 * their own config file.
 */
const tableFieldsCount = (app: App): number =>
  toFiniteCount((app.tables ?? []).reduce((total, table) => total + table.fields.length, 0))

/**
 * `agentsDefault` — whether the reserved general-purpose agent is exposed.
 *
 * `0` or `1` by construction, and `0` on an app that declares no agents: the
 * virtual `default` view exists as a conversation source, but the Agents tile
 * it sub-lines shows nothing at all on such an app, and a "1 default" line
 * under a zero would read as a contradiction rather than as information.
 */
const agentsDefaultCount = (app: App): number => ((app.agents ?? []).length > 0 ? 1 : 0)

/**
 * `bucketsS3` / `bucketsLocal` — the declared buckets, by resolved provider.
 *
 * A bucket declares no provider of its own: storage is an env-wide deployment
 * concern (`STORAGE_PROVIDER`), so every declared bucket resolves to the same
 * one. The pair therefore partitions `app.buckets[]` — and sums to `0` both
 * when no bucket is declared AND when the provider is `bytea` or disabled,
 * neither of which the tile's two halves can express.
 */
interface BucketSplit {
  readonly s3: number
  readonly local: number
}

const bucketSplit = (app: App): BucketSplit => {
  const declared = (app.buckets ?? []).length
  const provider = parseStorageEnvConfig()?.provider
  return {
    s3: provider === 's3' ? declared : 0,
    local: provider === 'local' ? declared : 0,
  }
}

/**
 * `teams` — the groups the app configures.
 *
 * Teams are managed THROUGH groups in this schema (`app.auth.groups[]`), as
 * the `groups` declaration says in as many words; there is no separate teams
 * key to read. An app with no auth, or auth with no groups, reports `0`.
 */
const teamsCount = (app: App): number => (app.auth?.groups ?? []).length

/**
 * Join the names of every source that could not be read.
 *
 * Returns `undefined` — never the empty string — when everything was read, so
 * the response can OMIT the key. Absence is the only healthy spelling: one
 * spelling per state means a client cannot read an empty string as "unknown"
 * or a missing key as a third case.
 */
const collectDegraded = (sources: readonly (string | undefined)[]): string | undefined => {
  const named = [...new Set(sources.filter((source): source is string => source !== undefined))]
  return named.length === 0 ? undefined : named.join(DETAIL_SEPARATOR)
}

/**
 * Build the attention report.
 *
 * `since` is injected rather than read from a module constant here: it is the
 * PROCESS boot, owned by the presentation layer's `PROCESS_STARTED_AT` (the
 * same constant `GET /api/admin/config/version` reports as `startedAt`), and
 * the two must be byte-identical. Passing it through is what makes that a
 * property of one value rather than of two clocks that agree most of the time.
 *
 * Every source-reading block cannot fail and cannot hang, so the composed
 * program requires the runtime's services and nothing else. The route
 * validates the assembled object against `adminAttentionResponseSchema` before
 * serializing (S4 hard allow-list).
 */
/**
 * The seven source reads, resolved concurrently and bounded on both axes.
 *
 * Split out of {@link buildAdminAttention} so the fan-out and the assembly are
 * separately readable: this function answers "what did the sources say?", and
 * the assembly below answers "what does the page render?". Every entry is
 * already un-failable — {@link degradeTo} rescued the failure axis and
 * `withBlockTimeout` rescues the latency one, each falling back to the SAME
 * `unread` envelope so the two degradation paths are indistinguishable to the
 * reader, as they should be: both produced a fallback rather than a
 * measurement.
 */
interface AttentionSources {
  readonly failedRuns: Sourced<Cell>
  readonly tokensExpired: Sourced<Cell>
  readonly invitationsPending: Sourced<Cell>
  readonly recentSubmissions: Sourced<Cell>
  readonly automations: Sourced<AutomationStates>
  readonly links: Sourced<LinkSplit>
  readonly usersBanned: Sourced<number>
}

/**
 * The four sources behind pulse cells that have no tile sub-line of their own.
 *
 * Each is wrapped so BOTH degradation axes land on the same `unread` envelope:
 * the block's own `orElseSucceed` for a source that fails, this
 * `withBlockTimeout` for one that is merely slow.
 */
const pulseSources = (app: App, since: Readonly<Date>, nowMs: number) =>
  [
    withBlockTimeout(
      failedRunsBlock(since),
      unread(EMPTY_CELL, 'automation runs'),
      SOURCE_TIMEOUT_MS
    ),
    withBlockTimeout(tokensExpiredBlock(), unread(EMPTY_CELL, 'connections'), SOURCE_TIMEOUT_MS),
    withBlockTimeout(
      invitationsPendingBlock(nowMs),
      unread(EMPTY_CELL, 'invitations'),
      SOURCE_TIMEOUT_MS
    ),
    withBlockTimeout(
      recentSubmissionsBlock(app, since),
      unread(EMPTY_CELL, 'form submissions'),
      SOURCE_TIMEOUT_MS
    ),
  ] as const

/**
 * The three sources behind tile sub-lines — one of which (`automations`) also
 * carries the sixth pulse cell, which is exactly why it is ONE read.
 */
const tileSources = (app: App) =>
  [
    withBlockTimeout(
      automationStatesBlock(app),
      unread(AUTOMATION_STATES_ZERO, 'automations'),
      SOURCE_TIMEOUT_MS
    ),
    withBlockTimeout(linksBlock(app), unread(LINK_SPLIT_ZERO, 'links'), SOURCE_TIMEOUT_MS),
    withBlockTimeout(usersBannedBlock(), unread(0, 'users'), SOURCE_TIMEOUT_MS),
  ] as const

const readSources = (
  app: App,
  since: Readonly<Date>,
  nowMs: number
): Effect.Effect<AttentionSources, never, AdminAttentionServices> =>
  Effect.gen(function* () {
    const [failedRuns, tokensExpired, invitationsPending, recentSubmissions] = yield* Effect.all(
      pulseSources(app, since, nowMs),
      { concurrency: SOURCE_CONCURRENCY }
    )
    const [automations, links, usersBanned] = yield* Effect.all(tileSources(app), {
      concurrency: SOURCE_CONCURRENCY,
    })

    return {
      failedRuns,
      tokensExpired,
      invitationsPending,
      recentSubmissions,
      automations,
      links,
      usersBanned,
    }
  })

/**
 * Project the resolved sources plus the app's own config onto the wire body.
 *
 * PURE, and deliberately so: everything that could fail has already been
 * rescued upstream, so what is left is the flattening — the step the whole
 * contract exists to pin. Every count goes through `toFiniteCount` on the way
 * out, because a `NaN` from an unusable aggregate travels as a SUCCESSFUL value
 * that neither the failure axis nor the latency one can intercept, and would
 * surface only at the route's response gate as a 500.
 */
const assembleAttention = (
  app: App,
  since: string,
  sources: Readonly<AttentionSources>
): AdminAttentionResponse => {
  const { failedRuns, tokensExpired, invitationsPending, recentSubmissions } = sources
  const { automations, links, usersBanned } = sources
  const variablesUnset = variablesUnsetCell(app)
  const buckets = bucketSplit(app)

  const degraded = collectDegraded([
    failedRuns.source,
    tokensExpired.source,
    invitationsPending.source,
    recentSubmissions.source,
    automations.source,
    links.source,
    usersBanned.source,
  ])

  return {
    since,

    failedRuns: toFiniteCount(failedRuns.value.count),
    failedRunsDetail: failedRuns.value.detail,

    variablesUnset: toFiniteCount(variablesUnset.count),
    variablesUnsetDetail: variablesUnset.detail,

    tokensExpired: toFiniteCount(tokensExpired.value.count),
    tokensExpiredDetail: tokensExpired.value.detail,

    invitationsPending: toFiniteCount(invitationsPending.value.count),
    invitationsPendingDetail: invitationsPending.value.detail,

    recentSubmissions: toFiniteCount(recentSubmissions.value.count),
    recentSubmissionsDetail: recentSubmissions.value.detail,

    automationsPaused: toFiniteCount(automations.value.paused.count),
    automationsPausedDetail: automations.value.paused.detail,

    tableFields: tableFieldsCount(app),
    automationsDisabled: toFiniteCount(automations.value.disabled),
    agentsDefault: agentsDefaultCount(app),
    bucketsS3: toFiniteCount(buckets.s3),
    bucketsLocal: toFiniteCount(buckets.local),
    linksConfig: toFiniteCount(links.value.config),
    linksDb: toFiniteCount(links.value.db),
    usersBanned: toFiniteCount(usersBanned.value),
    teams: teamsCount(app),

    generatedAt: new Date().toISOString(),
    // Omitted entirely when healthy — `degraded` has no false spelling.
    ...(degraded === undefined ? {} : { degraded }),
  }
}

/**
 * Build the attention report.
 *
 * `since` is injected rather than read from a module constant here: it is the
 * PROCESS boot, owned by the presentation layer's `PROCESS_STARTED_AT` (the
 * same constant `GET /api/admin/config/version` reports as `startedAt`), and
 * the two must be byte-identical. Passing it through is what makes that a
 * property of ONE value rather than of two clocks that agree most of the time.
 *
 * Every source-reading block cannot fail and cannot hang, so the composed
 * program requires the runtime's services and nothing else. The route validates
 * the assembled object against `adminAttentionResponseSchema` before
 * serializing (S4 hard allow-list).
 */
export const buildAdminAttention = (
  app: App,
  since: string
): Effect.Effect<AdminAttentionResponse, never, AdminAttentionServices> =>
  Effect.gen(function* () {
    const sources = yield* readSources(app, new Date(since), Date.now())
    return assembleAttention(app, since, sources)
  }).pipe(Effect.withSpan('admin.build-admin-attention'))
