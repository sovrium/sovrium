/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component-level visibility filtering for the page renderer.
 *
 * Extracted from `render-page.tsx` so the entry file stays under the
 * line cap. The three strategies are:
 *   - `capability` — fully exclude the component AND its subtree from the SSR
 *     output, based on what the CALLER may do (see
 *     {@link applyCallerCapabilityGate}). The same pass gates a data-table
 *     ACTION COLUMN, which carries its capability at its own root rather than
 *     under `visibility` (see {@link gateColumns}).
 *   - `condition` — fully exclude the component from the SSR output (the
 *     value never reaches the HTML for unauthorised users).
 *   - `when` / `roles` — render the component but inject `display: none`
 *     into its style prop (preserves DOM structure for client-side
 *     rehydration).
 *
 * Visibility config is read off `component.visibility` OR
 * `component.props.visibility`. BOTH positions are read because the schema
 * spreads `visibilityFields` at the component ROOT (`component-types/modules/
 * visibility.ts`) while the long-standing runtime convention put it under
 * `props` — a declaration in the position the schema documents was silently
 * inert until this was widened. The declarative shape lives in the schema layer
 * and is duck-typed here so the renderer stays decoupled from the Effect Schema
 * definitions.
 */

import { isAdminEquivalent, isAdminTier } from '@/domain/models/app/auth/roles'
import { isCapabilityMet } from '@/domain/models/app/pages/page-requires'
import { matchesConditionOperators } from '@/domain/models/app/tables/condition-operators'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type {
  CallerCapability,
  RuntimeCapability,
} from '@/domain/models/app/pages/components/visibility'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * Visibility config shape as stored in component props
 */
interface VisibilityCondition {
  readonly field: string
  readonly operator: 'eq' | 'neq'
  readonly value: string
}

interface VisibilityConfig {
  readonly when?: 'authenticated' | 'unauthenticated'
  readonly roles?: readonly string[]
  readonly condition?: VisibilityCondition
  readonly capability?: CallerCapability
  /** Rendered only when the HOST app declares this capability. */
  readonly declares?: PageCapability
  /** Rendered only when the HOST app does NOT declare this capability. */
  readonly unlessDeclares?: PageCapability
  /**
   * Rendered only when the capability can actually RUN here — the host app
   * declares it AND the environment can serve it. Resolved once per request by
   * the caller; see {@link runtimeGateMet}.
   */
  readonly runtime?: RuntimeCapability
  /** Rendered only when the capability CANNOT run here. */
  readonly unlessRuntime?: RuntimeCapability
  /**
   * Rendered only when a declared `page.query` property resolves to a value
   * satisfying the operators — the URL-STATE gate. `name` addresses a
   * `page.query` property rather than a record field, which is why it is not a
   * {@link VisibilityCondition}.
   */
  readonly query?: { readonly name: string } & Readonly<Record<string, unknown>>
}

/**
 * Evaluates a field-based condition against the current session.
 *
 * Supports $user.* field references (e.g., $user.role, $user.plan).
 * Returns true if the condition is satisfied.
 */
function evaluateCondition(
  condition: VisibilityCondition,
  session: SessionInfo | undefined
): boolean {
  const { field, operator, value } = condition

  // Resolve field value from session ($user.* references only)
  const fieldValue =
    field.startsWith('$user.') && session !== undefined
      ? (session as unknown as Record<string, string | undefined>)[field.slice('$user.'.length)]
      : undefined

  if (operator === 'eq') return fieldValue === value
  if (operator === 'neq') return fieldValue !== value
  return false
}

/**
 * Checks if the session role satisfies the role requirements of a visibility config.
 */
function isRoleVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  if (!visibility.roles || visibility.roles.length === 0) return true
  if (session === undefined) return false
  return visibility.roles.includes(session.role)
}

/**
 * Determines if a section should be visible given the current session.
 */
function isSectionVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  const isAuthenticated = session !== undefined

  if (visibility.when === 'authenticated' && !isAuthenticated) return false
  if (visibility.when === 'unauthenticated' && isAuthenticated) return false
  if (!isRoleVisible(visibility, session)) return false
  if (visibility.condition !== undefined && !evaluateCondition(visibility.condition, session))
    return false

  return true
}

/**
 * Extracts visibility config from a component node.
 *
 * Reads `props.visibility` FIRST, then the component ROOT. Both positions are
 * legal: the schema spreads `visibilityFields` at the root, while the
 * long-standing runtime convention nested it under `props`. Reading only one
 * made a declaration written in the OTHER position silently inert — a gate that
 * validates and does nothing, which is the worst failure mode an access control
 * has. `props` wins a (nonsensical) tie so the historical position keeps its
 * behaviour exactly.
 */
function extractVisibility(node: unknown): VisibilityConfig | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const obj = node as { readonly props?: Record<string, unknown>; readonly visibility?: unknown }
  const fromProps = obj.props?.visibility
  if (typeof fromProps === 'object' && fromProps !== null) return fromProps as VisibilityConfig
  if (typeof obj.visibility === 'object' && obj.visibility !== null) {
    return obj.visibility as VisibilityConfig
  }
  return undefined
}

/**
 * Returns true when visibility is purely condition-based (no when/roles).
 */
function isConditionOnlyVisibility(visibility: VisibilityConfig): boolean {
  return !visibility.when && (!visibility.roles || visibility.roles.length === 0)
}

/**
 * Applies visibility to a single section: either returns it unchanged,
 * or injects `display: none` into its style prop.
 */
function applyVisibilityToSection(
  section: Page['components'][number],
  session: SessionInfo | undefined
): Page['components'][number] {
  // The VALUE, not the key: `specimen` declares a `component` field holding a
  // whole component, and a key test would skip it here — leaving its `visible`
  // and `roles` declarations inert while every sibling honoured theirs.
  if (isComponentReferenceNode(section)) return section

  const component = section as Component
  const visibility = extractVisibility(component)
  if (!visibility) return component

  if (isConditionOnlyVisibility(visibility)) return component

  if (isSectionVisible(visibility, session)) return component

  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      style: {
        ...((component.props?.style as Record<string, unknown> | undefined) ?? {}),
        display: 'none',
      },
    },
  }
}

/**
 * True when a component node carries a `when`/`roles` visibility config that
 * EXCLUDES the given session. Condition-only visibility is ignored (it is
 * field-value based, not a session/role gate). Reads `props.visibility` (the
 * runtime convention) and tolerates a top-level `visibility` key (the schema
 * spreads `visibilityFields` at the component root).
 *
 * Consumed by the embedded-formRef access check: a formRef hidden from this
 * session is not part of the page for that session, so its form-access gate
 * must not 404 the page (the submit endpoint still enforces form access
 * independently).
 */
export function isComponentHiddenForSession(
  node: unknown,
  session: SessionInfo | undefined
): boolean {
  const visibility = extractVisibility(node)
  if (!visibility) return false
  if (isConditionOnlyVisibility(visibility)) return false
  return !isSectionVisible(visibility, session)
}

/**
 * Applies visibility filtering to page sections based on the current session.
 */
export function applyVisibilityToComponents(
  components: Page['components'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components
    .filter((item) => {
      if (isComponentReferenceNode(item)) return true

      const component = item as Component
      const visibility = extractVisibility(component)
      if (!visibility?.condition) return true

      return evaluateCondition(visibility.condition, session)
    })
    .map((item) => applyVisibilityToSection(item, session))
}

/**
 * True when the caller holds the named power.
 *
 * Both predicates are pure functions of `(session.role, app)` — that is the
 * entry criterion the closed set is built on, and it is what lets the gate run
 * inside a synchronous render pass. `session.role` rather than `effectiveRoles`
 * mirrors `isRoleVisible` above and the predicate table on `CallerCapability`.
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
  if (ctx.session === undefined) return false
  if (capability === 'admin-console') return isAdminTier(ctx.session.role, ctx.app)
  return isAdminEquivalent(ctx.session.role, ctx.app)
}

/**
 * Removes every component the caller lacks the declared capability for, and its
 * whole subtree with it.
 *
 * ─── WHY A SEPARATE PASS, AND WHY IT EXCLUDES ──────────────────────────────
 *
 * `when` / `roles` inject `display: none` and leave the markup in the response.
 * For a power gate that is a disclosure rather than a style: a CSS-hidden
 * action column still ships every row action's endpoint to a caller forbidden
 * to call it (rule S1/S4), and a greyed-out control advertises a power the
 * admin-route middleware answers with 404. So an unmet capability removes the
 * node entirely — the strategy `condition` already uses.
 *
 * ─── WHY IT RECURSES WHERE THE `condition` FILTER DOES NOT ─────────────────
 *
 * The `condition` filter is deliberately flat (top-level sections only). A
 * capability gate cannot be: the affordances it exists to hide — an action
 * column, an Invite button — sit inside the layout containers a console page is
 * built from, and a gate that silently stops applying at depth 2 is the same
 * "validates and does nothing" failure the root/props widening above fixes.
 * Recursing does not change the flat filter's behaviour, because a node
 * carrying no `capability` is returned by reference.
 *
 * Composition with `when` / `roles` / `condition` is AND, and it is ordered:
 * this pass runs first, so a component whose capability IS met still goes on to
 * be hidden or excluded by the other three exactly as before.
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
  return gateNodes(components, {
    session,
    app,
    hostApp,
    ...(granted !== undefined ? { granted } : {}),
    ...(runnable !== undefined ? { runnable } : {}),
    ...(queryValues !== undefined ? { queryValues } : {}),
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

/** Filter one array of nodes, then recurse into whatever survives. */
function gateNodes(nodes: readonly unknown[], ctx: GateContext): readonly unknown[] {
  return nodes
    .filter((node) => {
      const visibility = extractVisibility(node)
      if (visibility === undefined) return true
      const { capability } = visibility
      if (capability !== undefined && !holdsCapability(ctx, capability)) {
        return false
      }
      if (!queryGateMet(visibility, ctx.queryValues)) return false
      if (!runtimeGateMet(visibility, ctx.runnable)) return false
      return hostDeclarationMet(visibility, ctx.hostApp)
    })
    .map((node) => gateChildren(node, ctx))
}

/**
 * True when a component's URL-STATE gate is satisfied by the current request.
 *
 * ─── WHY THIS EXCLUDES RATHER THAN HIDES ───────────────────────────────────
 *
 * The one case this key exists for is two alternative bodies under two chips of
 * one page. Shipping both and hiding one with CSS would put both in the bytes:
 * find-in-page finds the unselected one, a reader selecting the page copies it,
 * and anything that does not honour the stylesheet reads them as one document.
 * "Only one of these applies" would then be false to everything that reads
 * HTML. So the node and its subtree leave the response entirely, which is why
 * this rides the `capability` pass rather than the `when` / `roles` one.
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
 * that declaration can actually run here — the conjunction
 * `appRequiresAi(hostApp) && isAiProviderConfigured(env)` that
 * `collectAiProviderPhases` already computes for the `AI disabled` startup
 * warning. The two disagree exactly where the key earns its place: on a host
 * declaring an agent with no provider, `declares: 'agents'` renders a composer
 * whose only possible outcome is a panel saying it is unavailable.
 *
 * ─── WHY THE ANSWER ARRIVES RESOLVED ───────────────────────────────────────
 *
 * The env half is read ONCE PER REQUEST by the caller, never here. A gate
 * reaching for `process.env` mid-render cannot be unit-tested per case, and
 * `appRequiresAi` walks the whole component tree — a cost that belongs to the
 * request, not to every node of this recursion.
 *
 * ─── WHY EXCLUSION ─────────────────────────────────────────────────────────
 *
 * Same reason as `declares`, plus one of its own. A CSS-hidden composer tells a
 * reader-of-source the instance can run AI when it cannot; and the real
 * composer is an ISLAND, so hiding it still ships the mount and its
 * `data-island-props` payload to a host that can never serve it.
 *
 * An ABSENT `runnable` leaves the gate inert, matching `queryGateMet` and
 * `holdsCapability`: a caller with no runtime context — a unit test, a static
 * build — has no way to answer the question, and excluding every gated block
 * there would silently empty pages whose author declared nothing wrong.
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

function hostDeclarationMet(visibility: VisibilityConfig, hostApp: App): boolean {
  const { declares, unlessDeclares } = visibility
  if (declares !== undefined && !isCapabilityMet(hostApp, declares)) return false
  if (unlessDeclares !== undefined && isCapabilityMet(hostApp, unlessDeclares)) return false
  return true
}

/**
 * Recurse into a surviving node's `children`, and gate its `columns`.
 *
 * A component REFERENCE is returned untouched — an unexpanded `$ref` has no
 * inlined children to walk, and `expandFormRefs` has already run for the ones
 * that do. A string child (inline text) is returned as-is.
 */
function gateChildren(node: unknown, ctx: GateContext): unknown {
  if (typeof node !== 'object' || node === null) return node
  if (isComponentReferenceNode(node as Page['components'][number])) return node

  const withColumns = gateColumns(node, ctx)
  const { children } = withColumns as { readonly children?: readonly unknown[] }
  if (!Array.isArray(children) || children.length === 0) return withColumns

  const gated = gateNodes(children, ctx)
  if (gated.length === children.length && gated.every((child, i) => child === children[i])) {
    return withColumns
  }
  return { ...(withColumns as Record<string, unknown>), children: gated }
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
