/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The capability pass of component visibility: removes every component, and a
 * data-table action column, whose capability the caller lacks or the request
 * context cannot serve. The session and condition gates are in
 * `visibility-filter.ts`; this pass reuses its pruning walk.
 */

import { sessionHoldsCapability } from '@/domain/models/app/pages/component-session-visibility-service'
import { matchesConditionOperators } from '@/domain/models/app/tables/condition-operators'
import { gateCommandRows } from '@/presentation/render/resolve/command-row-gate'
import {
  gateDeclaredActions,
  hostDeclarationMet,
} from '@/presentation/render/resolve/declared-actions'
import { gateMountedWrites } from '@/presentation/render/resolve/mounted-write-gate'
import { isOpenImportAdmitted, stampOpenImportFields } from './open-import-gate'
import { extractVisibility, pruneNodes } from './visibility-filter'
import type { VisibilityConfig } from './visibility-filter'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type {
  CallerCapability,
  RuntimeCapability,
} from '@/domain/models/app/pages/components/visibility'

/**
 * True when the caller holds the named power.
 *
 * Both predicates are pure functions of `(session.role, app)` — that is the
 * entry criterion the closed set is built on, and it is what lets the gate run
 * inside a synchronous render pass. `session.role` rather than `effectiveRoles`
 * matches the predicate table on `CallerCapability`.
 *
 * An ANONYMOUS caller holds nothing: a component gated on a capability is
 * absent for them without any `when: authenticated` written beside it.
 *
 * ─── WHY A CALLER MAY BE STATED RATHER THAN DERIVED ────────────────────────
 *
 * `ctx.granted`, when present, REPLACES the derivation entirely. It exists for
 * exactly one caller: a MOUNTED embedded app.
 *
 * A mounted console page renders SESSION-LESS. That is deliberate and load
 * bearing — handing `renderPage` a session would switch on page `access`,
 * `visibility.roles`, `visibility.condition`'s `$user.*`, the two CRUD
 * permission passes and collection row-level filtering across every console
 * surface in one move, which is a decision of its own and not one a capability
 * gate gets to make on the way past. But the mount has ALREADY resolved the
 * caller's two powers (`resolveCallerPosture`, `mounted-app-routes.ts`) in
 * order to decide whether to serve the request at all, so the answer this
 * predicate needs is a fact the route layer is holding and the renderer is not.
 *
 * Passing the derived POWERS rather than the session is what keeps that narrow:
 * a capability set cannot be read as a role, cannot resolve a `$user.*`
 * reference, and cannot reach a row-level filter. The blast radius is this
 * function.
 *
 * Without it, `capability` and an action column's `capability` are inert on
 * every mounted page — and inert in the WORSE direction: no session means no
 * capability, so the gate excludes the affordance from every caller including
 * the administrator it was written for, and the page renders as though the
 * column had never been declared.
 */
function holdsCapability(ctx: GateContext, capability: CallerCapability): boolean {
  if (ctx.granted !== undefined) return ctx.granted.has(capability)
  return sessionHoldsCapability(capability, ctx.session, ctx.app)
}

/**
 * Removes every component the caller lacks the declared capability for, and its
 * whole subtree with it.
 *
 * ─── WHY A SEPARATE PASS, AND WHY IT EXCLUDES ──────────────────────────────
 *
 * A power gate must never leave markup in the response: a CSS-hidden action
 * column still ships every row action's endpoint to a caller forbidden to call
 * it (rule S1/S4), and a greyed-out control advertises a power the admin-route
 * middleware answers with 404. So an unmet capability removes the node.
 *
 * ─── WHY IT RECURSES ───────────────────────────────────────────────────────
 *
 * The affordances a capability gate exists to hide — an action column, an
 * Invite button — sit inside the layout containers a console page is built
 * from, and a gate that silently stops applying at depth 2 is the same
 * "validates and does nothing" failure the root/props widening above fixes.
 * A node carrying no `capability` is returned by reference.
 *
 * Composition with `when` / `roles` / `condition` is AND: this pass runs
 * first, and a node it keeps can still be excluded by the other three.
 *
 * ─── THE SECOND QUESTION THIS PASS ANSWERS ─────────────────────────────────
 *
 * `declares` / `unlessDeclares` ask what the HOST app declares rather than what
 * the caller may do, and they share this pass because they share its one
 * load-bearing property: EXCLUSION. Shipping both halves of an alternating body
 * and hiding one with CSS tells a reader-of-source that the instance has a
 * capability it does not have. See {@link hostDeclarationMet}.
 *
 * @param hostApp - the app the `declares` clauses are evaluated AGAINST. For a
 *   mounted embedded console that is the OPERATOR's config — the fact the
 *   preset cannot otherwise reach — and for a standalone app it is `app`.
 */
export function applyCallerCapabilityGate(
  components: Page['components'],
  input: CallerCapabilityGateInput
): Page['components'] {
  if (!components) return components
  const { session, app, hostApp = app, grantedCapabilities, queryValues } = input
  const granted = grantedCapabilities === undefined ? undefined : new Set(grantedCapabilities)
  const runnable =
    input.runtimeCapabilities === undefined ? undefined : new Set(input.runtimeCapabilities)
  const ctx: GateContext = {
    session,
    app,
    hostApp,
    ...(granted !== undefined ? { granted } : {}),
    ...(runnable !== undefined ? { runnable } : {}),
    ...(queryValues !== undefined ? { queryValues } : {}),
  }
  return pruneNodes(components, {
    keep: (node) => isCallerGateMet(node, ctx) && isOpenImportAdmitted(node, ctx),
    reshape: (node) =>
      gateMountedWrites(
        gateDeclaredActions(
          stampOpenImportFields(
            gateCommandRows(gateColumns(node, ctx), (row) => isCallerGateMet(row, ctx)),
            ctx
          ),
          ctx.hostApp
        ),
        ctx.granted
      ),
  }) as Page['components']
}

/** Everything the gate needs about the request, as one bag. */
export interface CallerCapabilityGateInput {
  /** Who is asking. Absent for an anonymous caller, who holds nothing. */
  readonly session: SessionInfo | undefined
  /** The app being RENDERED, whose roles decide a capability. */
  readonly app: App
  /**
   * The app being SERVED FOR, whose config decides a `declares` clause. The two
   * differ only on a mount, and conflating them there would have a console ask
   * its own preset whether the operator automates. Defaults to `app`.
   */
  readonly hostApp?: App
  /**
   * The caller's powers, STATED rather than derived. Supplied only by a mount —
   * see {@link holdsCapability} for why the powers travel and the session does
   * not.
   */
  readonly grantedCapabilities?: readonly CallerCapability[]
  /**
   * The capabilities that can actually RUN for `hostApp` on this deployment,
   * RESOLVED by the caller rather than read here.
   *
   * Each is a conjunction of an app half and an env half
   * (`resolveRuntimeCapabilities`), and the env half is what keeps it out of
   * the gate: resolving it once per request at the filter-pipeline entry is
   * what lets every case below be unit-tested without an ambient `process.env`,
   * and what keeps `appRequiresAi`'s whole-tree walk off the per-node
   * recursion. The shape mirrors {@link grantedCapabilities} for the same
   * reason — the layer above holds a fact the renderer does not.
   */
  readonly runtimeCapabilities?: readonly RuntimeCapability[]
  /**
   * The page's resolved `page.query` values — supplied by the renderer, which
   * is where the request query and the declaration meet. Already clamped, so a
   * gate never sees a raw URL value.
   */
  readonly queryValues?: Readonly<Record<string, string>>
}

/**
 * What every gate below needs, in one bag: who is asking (`session`), the app
 * being RENDERED (`app`, whose roles decide a capability), and the app being
 * SERVED FOR (`hostApp`, whose config decides a declaration). The two apps
 * differ only on a mount, and conflating them there would have a console ask
 * its own preset whether the operator automates.
 */
interface GateContext {
  readonly session: SessionInfo | undefined
  readonly app: App
  readonly hostApp: App
  /**
   * The caller's powers, stated by the route layer instead of derived from
   * `session`. Present ONLY on a mount — see {@link holdsCapability}.
   */
  readonly granted?: ReadonlySet<CallerCapability>
  /**
   * The capabilities that can RUN here, resolved once per request by the
   * caller. Absent leaves the runtime gate inert — see {@link runtimeGateMet}.
   */
  readonly runnable?: ReadonlySet<RuntimeCapability>
  /**
   * The page's `page.query` properties, already CLAMPED to their declared
   * `enum`. Absent for a caller with no URL-state context, which leaves the
   * gate inert rather than excluding every gated block — the same degradation
   * `holdsCapability` makes when the powers do not travel.
   */
  readonly queryValues?: Readonly<Record<string, string>>
}

/** True when a node's capability, URL-state, runtime and declaration gates all pass. */
function isCallerGateMet(node: unknown, ctx: GateContext): boolean {
  const visibility = extractVisibility(node)
  if (visibility === undefined) return true
  const { capability, unlessCapability } = visibility
  if (capability !== undefined && !holdsCapability(ctx, capability)) return false
  if (unlessCapability !== undefined && holdsCapability(ctx, unlessCapability)) return false
  if (!queryGateMet(visibility, ctx.queryValues)) return false
  if (!runtimeGateMet(visibility, ctx.runnable)) return false
  return hostDeclarationMet(visibility, ctx.hostApp, node)
}

/**
 * True when a component's URL-STATE gate is satisfied by the current request.
 *
 * ─── WHY THIS EXCLUDES RATHER THAN HIDES ───────────────────────────────────
 *
 * The one case this key exists for is two alternative bodies under two chips of
 * one page. Shipping both and hiding one with CSS would put both in the bytes,
 * so the node and its subtree leave the response entirely — which is why this
 * rides the `capability` pass rather than the `when` / `roles` one.
 *
 * ─── WHY THE VALUE IS ALREADY CLAMPED ──────────────────────────────────────
 *
 * `resolvePageQueryValues` has already collapsed an unknown URL value onto the
 * property's `default`, so a gate can only ever be compared against a member of
 * the declared `enum`. That is what keeps `?mark=whatever` rendering the
 * default's body instead of emptying the panel — a gate reading the raw URL
 * value would match neither branch and serve a bodyless page, which no status
 * check would catch.
 *
 * An ABSENT `queryValues` leaves the gate inert (`true`). A caller with no
 * URL-state context — a unit test, a static build — has no way to answer the
 * question, and excluding every gated block there would silently empty pages
 * whose author declared nothing wrong. A gate naming a property the page does
 * not declare is refused at decode (`collectPageBindingViolations`), so the
 * remaining `undefined` lookup below is unreachable in a booted app and fails
 * closed if it ever is not.
 */
function queryGateMet(
  visibility: VisibilityConfig,
  queryValues: Readonly<Record<string, string>> | undefined
): boolean {
  const { query } = visibility
  if (query === undefined) return true
  if (queryValues === undefined) return true
  const { name, ...operators } = query
  return matchesConditionOperators(operators, queryValues[name])
}

/**
 * True when the host app satisfies both halves of a component's declaration
 * gate.
 *
 * ─── WHY THIS IS NOT `page.requires` ONE LEVEL DOWN ────────────────────────
 *
 * `page.requires` is all-or-nothing: an unmet page is never registered and
 * 404s. That is right for a page that would be MEANINGLESS — an API-keys
 * console on an instance with no `auth.apiKeys`. It is wrong for a page that
 * must stay reachable and say something honest: an Automations directory on an
 * app declaring none is not a 404, it is a page with an empty state. So the
 * capability SET is reused verbatim (`PageCapabilitySchema`) — one closed
 * vocabulary, so the two levels cannot drift into disagreeing about what
 * "declares automations" means — while the ANSWER to an unmet clause differs:
 * absent element here, absent page there.
 *
 * The two keys compose by AND, like every other key in the visibility struct,
 * so "automating but with no agents" is one component rather than two. Naming
 * the SAME capability in both is refused at decode — it could never render on
 * any instance, which is invisible at runtime.
 */
/**
 * True when a component's RUNTIME gate is satisfied by this deployment.
 *
 * ─── THE THIRD SUBJECT ─────────────────────────────────────────────────────
 *
 * {@link hostDeclarationMet} asks what the host app DECLARES. This asks whether
 * that declaration can actually run here — for `ai`, whether a provider is
 * configured (every app carries the built-in System Agent, so nothing else is
 * needed). The two disagree exactly where the key earns its place: on a host
 * declaring an agent with no provider, `declares: 'agents'` renders a composer
 * whose only possible outcome is a panel saying it is unavailable.
 *
 * ─── WHY THE ANSWER ARRIVES RESOLVED ───────────────────────────────────────
 *
 * The env half is read ONCE PER REQUEST by the caller, never here. A gate
 * reaching for `process.env` mid-render cannot be unit-tested per case.
 *
 * ─── WHY EXCLUSION ─────────────────────────────────────────────────────────
 *
 * Same reason as `declares`, plus one of its own: the composer is an ISLAND, so
 * hiding it still ships its `data-island-props` to a host that cannot serve it.
 *
 * An ABSENT `runnable` leaves the gate inert, matching `queryGateMet` and
 * `holdsCapability`: a caller with no runtime context cannot answer it.
 */
function runtimeGateMet(
  visibility: VisibilityConfig,
  runnable: ReadonlySet<RuntimeCapability> | undefined
): boolean {
  const { runtime, unlessRuntime } = visibility
  if (runtime === undefined && unlessRuntime === undefined) return true
  if (runnable === undefined) return true
  if (runtime !== undefined && !runnable.has(runtime)) return false
  if (unlessRuntime !== undefined && runnable.has(unlessRuntime)) return false
  return true
}

/**
 * Drop every data-table COLUMN whose declared capability the caller lacks.
 *
 * ─── WHY A SECOND POSITION, AND WHY IT IS NOT `visibility` ─────────────────
 *
 * `visibility.capability` gates a COMPONENT, and the affordance a members
 * directory has to withhold is one COLUMN of one grid. A column is not a
 * component — it has no `props`, no `children` and no `visibility` — so it
 * carries the capability at its own root (`ActionColumnSchema.capability`) and
 * is read here rather than through {@link extractVisibility}.
 *
 * ─── WHY EXCLUSION IS THE ONLY CORRECT ANSWER (S1/S4) ──────────────────────
 *
 * The grid is an ISLAND: its columns are serialised into `data-island-props`,
 * so a CSS-hidden or client-filtered action column still ships every row
 * action's URL, method and body to a caller the admin plane answers with 404.
 * Removing the column HERE — before the island builder ever sees the component
 * — is what keeps the endpoint out of the document entirely.
 *
 * Only an ACTION column takes a capability. A field column renders data the
 * grid already fetched over the wire, so hiding it hides nothing; its
 * confidentiality is `tables[].fields[].permissions`, enforced at the API. The
 * schema refuses `capability` on a field column, so a misplaced one is a boot
 * error rather than a silently inert gate.
 *
 * Returns the SAME node when nothing is dropped, so a grid with no gated column
 * pays one `filter` and no copy.
 */
function gateColumns(node: object, ctx: GateContext): object {
  const { columns } = node as { readonly columns?: readonly unknown[] }
  if (!Array.isArray(columns) || columns.length === 0) return node

  const kept = columns.filter((column) => {
    if (typeof column !== 'object' || column === null) return true
    const { capability } = column as { readonly capability?: CallerCapability }
    return capability === undefined || holdsCapability(ctx, capability)
  })
  if (kept.length === columns.length) return node
  return { ...(node as Record<string, unknown>), columns: kept }
}
