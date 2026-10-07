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

import { Effect } from 'effect'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import {
  AUTOMATION_STATES_ZERO,
  LINK_SPLIT_ZERO,
  agentsSystemCount,
  automationStatesBlock,
  bucketSplit,
  failedRunsBlock,
  invitationsPendingBlock,
  linksBlock,
  recentSubmissionsBlock,
  tableFieldsCount,
  teamsCount,
  tokensExpiredBlock,
  usersBannedBlock,
  variablesUnsetCell,
} from './attention-blocks'
import { DETAIL_SEPARATOR, EMPTY_CELL, unread } from './attention-cells'
import type { AutomationStates, LinkSplit } from './attention-blocks'
import type { Cell, Sourced } from './attention-cells'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { InvitationTokenRepository } from '@/application/ports/repositories/auth/invitation-token-repository'
import type { AdminAutomationsRepository } from '@/application/ports/repositories/automations/admin-automations-repository'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import type { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import type { UsersDirectoryRepository } from '@/application/ports/repositories/tables/users-directory-repository'
import type { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import type { AdminAttentionResponse } from '@/domain/models/api/admin/overview/attention'
import type { App } from '@/domain/models/app'
import type { Logger } from '@/infrastructure/logging/logger'

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
  // The pending-invitation ledger behind the `invitationsPending` cell.
  | InvitationTokenRepository

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
    withBlockTimeout(tokensExpiredBlock, unread(EMPTY_CELL, 'connections'), SOURCE_TIMEOUT_MS),
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
    withBlockTimeout(usersBannedBlock, unread(0, 'users'), SOURCE_TIMEOUT_MS),
  ] as const

/**
 * The seven source reads, resolved concurrently and bounded on both axes.
 *
 * Split out of {@link buildAdminAttention} so the fan-out and the assembly are
 * separately readable: this function answers "what did the sources say?", and
 * the assembly below answers "what does the page render?". Every entry is
 * already un-failable — `degradeTo` in `attention-cells.ts` rescued the failure axis and
 * `withBlockTimeout` rescues the latency one, each falling back to the SAME
 * `unread` envelope so the two degradation paths are indistinguishable to the
 * reader, as they should be: both produced a fallback rather than a
 * measurement.
 */
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
    agentsSystem: agentsSystemCount(),
    bucketsSystem: buckets.system,
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
