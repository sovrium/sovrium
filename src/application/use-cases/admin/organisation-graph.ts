/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the console Organisation page's ONE read
 * (`GET /api/admin/organisation/graph`).
 *
 * The page draws five lenses — Map, Matrix, Reach, Processes, Agents — plus a
 * findings list. They are not five reads: they are five projections of one
 * access graph, `principals -> grant sources -> resources`, plus the process
 * lanes. So this builds the graph once and the lens is a client concern.
 *
 * This module owns the half that can FAIL — the three runtime reads and their
 * degradation — and delegates the pure fold to
 * `organisation-graph-projection.ts` and the findings to
 * `organisation-graph-findings.ts`.
 *
 * ─── WHAT IS CONFIG AND WHAT IS RUNTIME ─────────────────────────────────────
 *
 * The resource half and the grant half are a pure fold over the LIVE app, and
 * cost ZERO queries: the decoded app is already in process.
 *
 * The principal half is runtime and costs THREE, and the design exists to keep
 * it three:
 *
 *   - the account population, one unpaginated scan;
 *   - every team membership, ONE join over `team_member` x `team`;
 *   - the automation pause ledger, one list.
 *
 * The bound is independent of how many teams, tables or principals the instance
 * has. A fourth query per team or per principal is a review failure rather than
 * an optimisation opportunity, which is why
 * `[internal ref]` asserts INVARIANCE under growth and
 * not merely a ceiling: a ceiling alone passes on an instance too small to
 * reveal the fan-out. `listAllTeamMemberships` exists for exactly this reason —
 * its per-team sibling would have been the N+1.
 *
 * ─── A DEGRADED SOURCE IS NOT AN EMPTY ONE ──────────────────────────────────
 *
 * The sibling reads learned this the expensive way, and the stakes are higher
 * here than a wrong tile: a membership read that silently answered nothing
 * turns "this person is the only bridge between two teams" into no finding at
 * all — the exposure DISAPPEARS rather than being reported as unknown. So each
 * runtime source returns a {@link Sourced} envelope naming itself on failure,
 * the names are joined into `degraded`, and a degraded source contributes
 * nothing rather than a zero that reads as calm.
 *
 * The automation-state case is the sharpest: an unreadable pause ledger means
 * the automation nodes ship with NO `state` key at all, because emitting
 * `active` would assert that nothing is paused on the strength of a read that
 * failed.
 *
 * ─── S4: WHAT THIS BODY IS ALLOWED TO CARRY ─────────────────────────────────
 *
 * Names, and sentences about names. A `person` node carries a display name and
 * never the account's email — the users directory already publishes addresses
 * to the same callers, so carrying one here would widen nothing legally, but
 * the graph needs a name and nothing more and the narrower body is the one to
 * ship. An account with no name falls back to a placeholder rather than to its
 * address, which is the whole point of the rule.
 *
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 * @see src/application/use-cases/admin/attention.ts (the sibling degradation pattern)
 */

import { Cause, Effect } from 'effect'
import { OrganizationTeamRepository } from '@/application/ports/repositories/auth/organization-team-repository'
import { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import { UsersDirectoryRepository } from '@/application/ports/repositories/tables/users-directory-repository'
import {
  withEndpointLabels,
  withPrincipalFigures,
} from '@/application/use-cases/admin/organisation-graph-denormalisation'
import { deriveExceptions } from '@/application/use-cases/admin/organisation-graph-exceptions'
import { deriveFindings } from '@/application/use-cases/admin/organisation-graph-findings'
import { narrowToNode } from '@/application/use-cases/admin/organisation-graph-narrowing'
import {
  agentEdges,
  agentNodes,
  automationEdges,
  automationNodes,
  grantEdges,
  openNodes,
  personEdges,
  personNodes,
  resourceNodes,
  resourceTargets,
  roleNodes,
  teamNodes,
} from '@/application/use-cases/admin/organisation-graph-projection'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { Logger } from '@/infrastructure/logging/logger'
import type { OrganizationTeamMembershipRecord } from '@/application/ports/repositories/auth/organization-team-repository'
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
import type {
  AdminOrganisationGraphEdge,
  AdminOrganisationGraphQuery,
  AdminOrganisationGraphResponse,
} from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'

/**
 * Every port this read touches, as one name.
 *
 * Stated once rather than repeated on {@link buildAdminOrganisationGraph}'s
 * signature: the graph's requirement IS the union of its sources', and writing
 * it out twice is how the two drift. All of them are carried by the server
 * runtime, so the route discharges the whole set with a single `provideDomain`.
 */
export type AdminOrganisationGraphServices =
  // The sources log their own degradation through the service rather than the
  // bare sink, so a test can assert on WHY a source went missing.
  Logger | UsersDirectoryRepository | OrganizationTeamRepository | AutomationPauseRepository

// ─── Degradation envelope ───────────────────────────────────────────────────

/**
 * A source's result, carrying its own name when it could NOT be read.
 *
 * `source` is a required key holding `string | undefined` rather than an
 * optional key, so a source cannot forget to answer the question — the whole
 * point of the envelope is that "was this read?" is never left implicit.
 */
interface Sourced<A> {
  readonly value: A
  readonly source: string | undefined
}

/** The healthy spelling: a value that was actually read. */
const measured = <A>(value: A): Sourced<A> => ({ value, source: undefined })

/** The degraded spelling: the empty contribution, and the name of what failed. */
const unread = <A>(value: A, source: string): Sourced<A> => ({ value, source })

/**
 * Record WHY a source degraded, then fall back to its empty contribution.
 *
 * `Effect.tapCause` runs AHEAD of the fallback and preserves the cause, so the
 * source still cannot fail while the reason survives — defects and
 * interruptions included, which a failure-only tap would drop. Placement is
 * load-bearing: a tap after the swallow observes nothing (E6).
 */
const degradeTo = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  source: string,
  empty: A
): Effect.Effect<Sourced<A>, never, R | Logger> =>
  effect.pipe(
    Effect.map(measured),
    Effect.tapCause((cause: Cause.Cause<E>) =>
      Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.error(
          `Organisation graph source '${source}' could not be read; its contribution is missing rather than empty`,
          Cause.squash(cause),
          { 'sovrium.admin.organisation.source': source }
        )
      })
    ),
    Effect.orElseSucceed(() => unread(empty, source))
  )

/**
 * Per-source latency budget (milliseconds).
 *
 * Mirrors the sibling reads: `orElseSucceed` rescues a source that FAILS but
 * not one that is merely slow, and a slow source would push the whole request
 * past the Hono API timeout into a 504. A partial graph is the product; a
 * gateway timeout is not.
 */
const SOURCE_TIMEOUT_MS = 8000

/** The three source names this read can put in `degraded`. */
const PRINCIPALS_SOURCE = 'principals'
const TEAM_MEMBERSHIP_SOURCE = 'team-membership'
const AUTOMATION_STATE_SOURCE = 'automation-state'

// ─── The three runtime reads ────────────────────────────────────────────────

interface GraphSources {
  readonly principals: Sourced<readonly DirectoryUserRow[]>
  readonly memberships: Sourced<readonly OrganizationTeamMembershipRecord[]>
  readonly paused: Sourced<ReadonlySet<string>>
}

/**
 * The EMPTY contribution of each source — what the graph gets when a read fails
 * or hangs.
 *
 * Named constants rather than inline literals because each appears twice (once
 * as the failure fallback, once as the timeout fallback) and the two must be the
 * same value: a source that degraded differently depending on HOW it degraded
 * would be two behaviours wearing one name in `degraded`.
 */
const NO_PRINCIPALS: readonly DirectoryUserRow[] = []
const NO_MEMBERSHIPS: readonly OrganizationTeamMembershipRecord[] = []
const NO_PAUSES: ReadonlySet<string> = new Set<string>()

/** All three sources run at once; none depends on another's answer. */
const SOURCE_CONCURRENCY = 3

/** The three runtime reads, concurrently, each rescued into its own envelope. */
const readSources = (): Effect.Effect<GraphSources, never, AdminOrganisationGraphServices> =>
  Effect.gen(function* () {
    const [principals, memberships, paused] = yield* Effect.all(
      [
        withBlockTimeout(
          degradeTo(
            Effect.gen(function* () {
              const repo = yield* UsersDirectoryRepository
              return yield* repo.listAllUsers()
            }),
            PRINCIPALS_SOURCE,
            NO_PRINCIPALS
          ),
          unread(NO_PRINCIPALS, PRINCIPALS_SOURCE),
          SOURCE_TIMEOUT_MS
        ),
        withBlockTimeout(
          degradeTo(
            Effect.gen(function* () {
              const repo = yield* OrganizationTeamRepository
              return yield* repo.listAllTeamMemberships
            }),
            TEAM_MEMBERSHIP_SOURCE,
            NO_MEMBERSHIPS
          ),
          unread(NO_MEMBERSHIPS, TEAM_MEMBERSHIP_SOURCE),
          SOURCE_TIMEOUT_MS
        ),
        // `listPausedNames` rather than its enriched sibling `listPauses`: the
        // graph draws a lane's STATE and never who paused it, so the narrow read
        // projects one column instead of joining `auth.user` for a display name
        // nothing renders. Both are ONE query, so the cost bound is the same
        // either way and the cheaper spelling wins.
        withBlockTimeout(
          degradeTo(
            Effect.gen(function* () {
              const repo = yield* AutomationPauseRepository
              return yield* repo.listPausedNames
            }),
            AUTOMATION_STATE_SOURCE,
            NO_PAUSES
          ),
          unread(NO_PAUSES, AUTOMATION_STATE_SOURCE),
          SOURCE_TIMEOUT_MS
        ),
      ] as const,
      { concurrency: SOURCE_CONCURRENCY }
    )
    return { principals, memberships, paused }
  })

/** Join the names of every source that could not be read, in a stable order. */
const collectDegraded = (sources: GraphSources): readonly string[] =>
  [sources.principals.source, sources.memberships.source, sources.paused.source].filter(
    (source): source is string => source !== undefined
  )

// ─── Assembly ───────────────────────────────────────────────────────────────

/**
 * Project the live config plus the three resolved sources onto the wire body.
 *
 * PURE, and deliberately so: everything that could fail has already been
 * rescued upstream, so what is left is the fold — the step the contract exists
 * to pin.
 *
 * The EDGES are built first and the role/team vocabularies are then closed over
 * what those edges actually name. That order IS the referential invariant: a
 * vocabulary derived from the config alone would drop a role an account holds
 * but nobody granted, and the `member` edge pointing at it would draw a line to
 * nowhere.
 *
 * The two DENORMALISED facts come last, in that order and for the same reason:
 * the labels are a join over the finished node list, and the figures are a fold
 * over the finished edge list. Computing either earlier would read a collection
 * that is not yet closed.
 */
const assembleGraph = (app: App, sources: GraphSources): AdminOrganisationGraphResponse => {
  const targets = resourceTargets(app)
  const agents = app.agents ?? []
  const automations = app.automations ?? []
  const principals = sources.principals.value
  const memberships = sources.memberships.value

  const edges: readonly AdminOrganisationGraphEdge[] = [
    ...grantEdges(targets),
    ...personEdges(principals, memberships),
    ...agentEdges(agents),
    ...automationEdges(automations),
  ]

  const nodes = [
    ...personNodes(principals),
    ...agentNodes(agents),
    ...roleNodes(app, principals, edges),
    ...teamNodes(app, memberships, edges),
    ...openNodes(edges),
    ...resourceNodes(targets),
    // `undefined` when the pause ledger was unreadable, which is what makes
    // every lane ship without a `state` key rather than claiming `active`.
    ...automationNodes(
      automations,
      sources.paused.source === undefined ? sources.paused.value : undefined
    ),
  ]

  return {
    nodes: withPrincipalFigures(nodes, edges),
    edges: withEndpointLabels(edges, nodes),
    findings: deriveFindings(targets, principals, memberships),
    exceptions: deriveExceptions(app),
    degraded: collectDegraded(sources),
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Apply `?node=`, or hand back the whole graph untouched.
 *
 * `findings` and `degraded` ride through by spread rather than being re-derived:
 * they describe the INSTANCE and the read's health, and a findings list that
 * shrank when an operator clicked a person would be reporting that the exposure
 * went away.
 *
 * `appliedNode` is echoed even when the id matched nothing, because without it a
 * caller cannot tell a server that honoured the filter from an older one that
 * ignored an unknown parameter — and on this page the two look identical in the
 * worst direction, the second rendering "this subject reaches everything".
 */
const narrowResponse = (
  graph: AdminOrganisationGraphResponse,
  node: string | undefined
): AdminOrganisationGraphResponse =>
  node === undefined ? graph : { ...graph, ...narrowToNode(graph, node), appliedNode: node }

/**
 * Build the organisation access graph.
 *
 * `app` is the LIVE config rather than the boot one: `tables`, `pages` and
 * `buckets` sit outside the restart set, so they hot-swap under `--watch` and
 * after a draft publish — and a page whose entire job is to explain the
 * configuration the server is running must not describe the previous one.
 *
 * `query.node` narrows the RESULT and never the reads: the whole graph is
 * assembled first and the filter is a fold over it, so a narrowed request costs
 * exactly the three queries an unfiltered one costs. Resolving the subject from
 * the database instead would be a fourth query, and a per-principal one at that.
 *
 * Every source-reading block cannot fail and cannot hang, so the composed
 * program requires the runtime's services and nothing else. The route validates
 * the assembled object against `adminOrganisationGraphResponseSchema` before
 * serialising (S4 hard allow-list).
 */
export const buildAdminOrganisationGraph = (
  app: App,
  query: AdminOrganisationGraphQuery = {}
): Effect.Effect<AdminOrganisationGraphResponse, never, AdminOrganisationGraphServices> =>
  Effect.gen(function* () {
    const sources = yield* readSources()
    return narrowResponse(assembleGraph(app, sources), query.node)
  }).pipe(Effect.withSpan('admin.build-admin-organisation-graph'))
