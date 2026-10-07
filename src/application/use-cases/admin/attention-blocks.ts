/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The blocks of the attention report: one read per pulse cell or tile sub-line,
 * each un-failable and naming its source when it degrades, plus the counts read
 * straight off the app config.
 */
import { Cause, Effect } from 'effect'
import { InvitationTokenRepository } from '@/application/ports/repositories/auth/invitation-token-repository'
import { AdminAutomationsRepository } from '@/application/ports/repositories/automations/admin-automations-repository'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import { UsersDirectoryRepository } from '@/application/ports/repositories/tables/users-directory-repository'
import { BuildAutomationsCatalog } from '@/application/use-cases/admin/automations-catalog'
import { buildEnvVarStatuses } from '@/application/use-cases/admin/config/env-status'
import { BuildConnectionsList } from '@/application/use-cases/admin/connections'
import { projectInvitations } from '@/application/use-cases/auth/admin-invitation-lifecycle'
import { buildCatalog } from '@/application/use-cases/links/catalog'
import { configSlugs } from '@/application/use-cases/links/config-slugs'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { FINAL_FAILURE_RUN_STATUSES } from '@/domain/models/app/automations/automation-run-outcome-service'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { Logger } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import {
  EMPTY_CELL,
  cellOf,
  formatStamp,
  formatWaited,
  measured,
  tallyCell,
  unread,
} from './attention-cells'
import type { Cell, Sourced } from './attention-cells'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import type { App } from '@/domain/models/app'

/**
 * How many failed runs are scanned to build the `failedRuns` cell.
 *
 * The cell reports a COUNT and names at most `MAX_DETAIL_SUBJECTS` in `attention-cells.ts`
 * automations, so an exact count past this bound buys the operator nothing
 * they would act on differently — "more than 500 runs have failed since boot"
 * and "512 have" prompt the same response. Bounding the scan is what keeps a
 * pathological instance from reading its whole run history into memory to
 * render one line.
 */
const FAILED_RUNS_SCAN_LIMIT = 500

/**
 * Record WHY a block degraded, then fall back to its unread envelope.
 *
 * `Effect.tapCause` runs AHEAD of the fallback and preserves the cause, so the
 * block still cannot fail while the reason survives — defects and
 * interruptions included, which a failure-only tap would drop. Placement is
 * load-bearing: a tap after the swallow observes nothing (E6).
 *
 * Module-private: every block below goes through it, and nothing else does.
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

// ─── The six pulse cells ────────────────────────────────────────────────────

/**
 * `failedRuns` — automation runs that ended in failure since `since` (EVENT).
 *
 * Read through `listAdminRuns` rather than the overview's
 * `listOverviewRowsSince`, because the latter projects `{ startedAt, createdAt,
 * status }` and drops the automation NAME — and a count with nothing under it
 * tells the operator where to look precisely nothing.
 */
export const failedRunsBlock = (
  since: Readonly<Date>
): Effect.Effect<Sourced<Cell>, never, AdminAutomationsRepository | Logger> =>
  degradeTo(
    Effect.gen(function* () {
      const repo = yield* AdminAutomationsRepository
      // Every FINAL failure, not only `failed`: a run that exhausted its
      // retries or timed out failed just as much, and the alert emails already
      // count all three. The runs reader filters on one status, so one read
      // per status.
      const perStatus = yield* Effect.forEach(FINAL_FAILURE_RUN_STATUSES, (status) =>
        repo.listAdminRuns({ status, from: since, limit: FAILED_RUNS_SCAN_LIMIT })
      )
      return tallyCell(perStatus.flat().map((run) => run.automationName))
    }),
    'automation runs',
    EMPTY_CELL
  ).pipe(Effect.withSpan('admin.attention-failed-runs'))

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
export const variablesUnsetCell = (app: App): Cell =>
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
export const tokensExpiredBlock: Effect.Effect<
  Sourced<Cell>,
  never,
  ConnectionRepository | ConnectionTokenRepository | OAuthStateStore | Logger
> = degradeTo(
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
).pipe(Effect.withSpan('admin.attention-tokens-expired'))

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
export const invitationsPendingBlock = (
  nowMs: number
): Effect.Effect<Sourced<Cell>, never, InvitationTokenRepository | Logger> =>
  degradeTo(
    Effect.gen(function* () {
      return yield* (yield* InvitationTokenRepository).listPending
    }).pipe(
      Effect.map((rows) => {
        const invitations = projectInvitations(rows, new Date(nowMs))
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
  ).pipe(Effect.withSpan('admin.attention-invitations-pending'))

/**
 * `recentSubmissions` — form submissions received since `since` (EVENT).
 *
 * NOT the lifetime figure, which is `GET /api/admin/overview`'s
 * `submissions.total`. The per-form fan-out is bounded (`concurrency: 2`) so a
 * form-heavy app cannot exhaust the connection pool while the other sources
 * read concurrently.
 */
export const recentSubmissionsBlock = (
  app: App,
  since: Readonly<Date>
): Effect.Effect<Sourced<Cell>, never, AdminFormsRepository | Logger> => {
  const forms = app.forms ?? []
  return degradeTo(
    Effect.gen(function* () {
      const repo = yield* AdminFormsRepository
      const perForm = yield* Effect.forEach(
        forms,
        (form) =>
          repo
            .listSubmissionsSince(form.name, since)
            .pipe(Effect.map((rows) => rows.map(() => form.name))),
        { concurrency: 2 }
      )
      return tallyCell(perForm.flat())
    }),
    'form submissions',
    EMPTY_CELL
  ).pipe(Effect.withSpan('admin.attention-recent-submissions'))
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
export interface AutomationStates {
  readonly paused: Cell
  readonly disabled: number
}

export const AUTOMATION_STATES_ZERO: AutomationStates = { paused: EMPTY_CELL, disabled: 0 }

export const automationStatesBlock = (
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
                : `${item.name} · since ${formatStamp(item.pausedAt, resolveOperatorTimezone())}`
            )
        ),
        disabled: catalog.items.filter((item) => item.state === 'disabled').length,
      }))
    ),
    'automations',
    AUTOMATION_STATES_ZERO
  ).pipe(Effect.withSpan('admin.attention-automation-states'))

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
export interface LinkSplit {
  readonly config: number
  readonly db: number
}

export const LINK_SPLIT_ZERO: LinkSplit = { config: 0, db: 0 }

export const linksBlock = (
  app: App
): Effect.Effect<Sourced<LinkSplit>, never, LinkRepository | Logger> =>
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
  ).pipe(Effect.withSpan('admin.attention-links'))

/**
 * `usersBanned` — accounts whose ban flag is set.
 *
 * A subset of the Users tile's own headline, never larger: a banned user is
 * still a user. Read through the directory port, which already excludes
 * agent-mirrored accounts (an agent is not a person) — so the subset relation
 * holds against the figure the tile above it shows.
 */
export const usersBannedBlock: Effect.Effect<
  Sourced<number>,
  never,
  UsersDirectoryRepository | Logger
> = degradeTo(
  Effect.gen(function* () {
    const repository = yield* UsersDirectoryRepository
    const rows = yield* repository.listAllUsers()
    return rows.filter((row) => row.banned === true).length
  }),
  'users',
  0
).pipe(Effect.withSpan('admin.attention-users-banned'))

/**
 * `tableFields` — declared fields summed across every configured table.
 *
 * Config-derived and therefore exact: this is a reduction over `app.tables[]`,
 * not a count of physical columns, so it matches what the operator reads in
 * their own config file.
 */
export const tableFieldsCount = (app: App): number =>
  toFiniteCount((app.tables ?? []).reduce((total, table) => total + table.fields.length, 0))

/**
 * `agentsSystem` — whether the built-in System Agent can run here.
 *
 * `0` or `1` by construction. Every app carries the System Agent, so the figure
 * does not depend on what the app declares: it is `1` exactly when an AI
 * provider is configured, which is the one thing the agent needs to answer.
 */
export const agentsSystemCount = (): number => (isAiProviderConfigured(process.env) ? 1 : 0)

/**
 * `bucketsSystem` / `bucketsS3` / `bucketsLocal` — the buckets the console
 * lists, split into the built-in one and the declared ones by provider.
 *
 * A bucket declares no provider of its own: storage is an env-wide deployment
 * concern (`STORAGE_PROVIDER`), so every declared bucket resolves to the same
 * one. The `s3`/`local` pair therefore partitions `app.buckets[]` — and sums
 * to `0` both when no bucket is declared AND when the provider is `bytea` or
 * disabled, neither of which those two halves can express.
 *
 * `system` is the built-in bucket, which exists wherever a storage provider
 * resolves (`s3`, `local` or `bytea` — every config the parser can return),
 * the same condition under which the buckets console lists it. It is counted
 * apart from the declared buckets, so the three figures together add up to
 * what that console lists.
 */
export const bucketSplit = (
  app: App
): { readonly system: number; readonly s3: number; readonly local: number } => {
  const declared = (app.buckets ?? []).length
  const provider = parseStorageEnvConfig()?.provider
  return {
    system: provider === undefined ? 0 : 1,
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
export const teamsCount = (app: App): number => (app.auth?.groups ?? []).length
