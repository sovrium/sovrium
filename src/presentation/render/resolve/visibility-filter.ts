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
 * line cap. EVERY gate excludes — none of them hides with CSS:
 *   - `capability` — fully exclude the component AND its subtree from the SSR
 *     output, based on what the CALLER may do (see
 *     {@link applyCallerCapabilityGate}). The same pass gates a data-table
 *     ACTION COLUMN, which carries its capability at its own root rather than
 *     under `visibility` (see {@link gateColumns}).
 *   - `condition` / `when` / `roles` — fully exclude the component AND its
 *     subtree from the SSR output, at any depth (see
 *     {@link applyVisibilityToComponents}). These are access controls: a
 *     reader they exclude must not receive the gated text at all, and a
 *     `display: none` node still ships it in the bytes.
 *
 * Visibility config is read off `component.visibility` OR
 * `component.props.visibility`. The SESSION half — `when`, `roles`, the
 * `$user.*` `condition`, a session-derived `capability` — is the domain's
 * (`component-session-visibility-service.ts`), so the page a caller is shown
 * and the page buttons that caller may press are judged by one rule. The
 * request-context halves (`query`, `runtime`, `declares`, granted powers on a
 * mount) are judged here.
 */

import {
  sessionGatesAdmit,
  sessionHoldsCapability,
  visibilityOf,
  type SessionVisibility,
} from '@/domain/models/app/pages/component-session-visibility-service'
import { isCapabilityMet } from '@/domain/models/app/pages/page-requires'
import { matchesConditionOperators } from '@/domain/models/app/tables/condition-operators'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { collectOverlayTargets, overlayIdOf } from '@/presentation/render/resolve/overlay-triggers'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type {
  CallerCapability,
  RuntimeCapability,
} from '@/domain/models/app/pages/components/visibility'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * Visibility config shape as stored on a component: the session half the
 * domain judges, plus the request-context halves this module judges.
 */
interface VisibilityConfig extends SessionVisibility {
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
   * `$user.*` condition.
   */
  readonly query?: { readonly name: string } & Readonly<Record<string, unknown>>
}

/** The node's `visibility` block — see {@link visibilityOf} for the two positions read. */
const extractVisibility = (node: unknown): VisibilityConfig | undefined =>
  visibilityOf<VisibilityConfig>(node)

/**
 * True when a node's `condition` / `when` / `roles` gates admit the session.
 *
 * THE one rule both {@link applyVisibilityToComponents} and
 * {@link isComponentHiddenForSession} answer with — a node is on the page for
 * this session exactly when this returns true.
 */
function isNodeVisibleForSession(
  node: unknown,
  session: SessionInfo | undefined,
  app: App
): boolean {
  if (typeof node !== 'object' || node === null) return true
  if (isComponentReferenceNode(node as Page['components'][number])) return true
  const visibility = extractVisibility(node)
  return visibility === undefined || sessionGatesAdmit(visibility, session, app)
}

/**
 * True when a component node carries a `condition` / `when` / `roles`
 * visibility config that EXCLUDES the given session.
 *
 * Consumed by the embedded-formRef passes that run BEFORE the page is pruned
 * (the page-access check and the option-set read): a formRef excluded for this
 * session is not part of the page for that session, so its form-access gate
 * must not 404 the page (the submit endpoint still enforces form access
 * independently). It is the negation of the very predicate
 * {@link applyVisibilityToComponents} prunes with, so the two can never
 * disagree about whether a gated form is on the page.
 */
export function isComponentHiddenForSession(
  node: unknown,
  session: SessionInfo | undefined,
  app: App
): boolean {
  return !isNodeVisibleForSession(node, session, app)
}

/**
 * How one pruning pass decides: which nodes stay, and — for a surviving node —
 * any reshaping of its own fields before its descendants are walked.
 */
interface PruneRule {
  readonly keep: (node: unknown) => boolean
  readonly reshape?: (node: object) => object
}

/** Same length and same elements by reference — the "nothing changed" test. */
function isSameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

/** Keep what `rule` admits from one list, then walk into whatever survives. */
function pruneNodes(nodes: readonly unknown[], rule: PruneRule): readonly unknown[] {
  return nodes.filter(rule.keep).map((node) => pruneNode(node, rule))
}

/**
 * Walk a SURVIVING node: reshape it, then prune its `children` and every
 * `responsive` breakpoint's `children`.
 *
 * A component REFERENCE is returned untouched — references are inlined before
 * the page passes run (`component-reference-expansion.ts`), so one still here
 * names a template that does not exist and has no subtree to walk. A string
 * child (inline text) is returned as-is.
 *
 * Both child positions are walked because both are RENDERED server-side:
 * `responsive.<bp>.children` is drawn into the HTML for every breakpoint and
 * shown or hidden by a media-query class, so a gated node there that this walk
 * skipped would ship to every reader — the exact leak exclusion exists to stop.
 */
function pruneNode(node: unknown, rule: PruneRule): unknown {
  if (typeof node !== 'object' || node === null) return node
  if (isComponentReferenceNode(node as Page['components'][number])) return node
  const reshaped = rule.reshape === undefined ? node : rule.reshape(node)
  return pruneResponsiveChildren(pruneChildren(reshaped, rule), rule)
}

/**
 * Prune a node's `children`, keeping a `tabs` strip aligned with its bodies.
 *
 * `tabs.panels[i]` names the tab that shows `children[i]` — the alignment is
 * positional, and decode refuses the two at different lengths. Dropping a
 * gated body without dropping its panel would slide every later body under
 * the wrong tab and leave the last tab empty. So when the two are aligned, a
 * dropped child takes its panel with it: a reader the body is withheld from is
 * not shown a tab for it either.
 */
function pruneChildren(node: object, rule: PruneRule): object {
  const { children, panels } = node as {
    readonly children?: readonly unknown[]
    readonly panels?: readonly unknown[]
  }
  if (!Array.isArray(children) || children.length === 0) return node
  const kept = children.map((child) => rule.keep(child))
  const pruned = children.flatMap((child, i) => (kept[i] ? [pruneNode(child, rule)] : []))
  if (isSameList(pruned, children)) return node
  const alignedPanels =
    Array.isArray(panels) && panels.length === children.length
      ? { panels: panels.filter((_, i) => kept[i]) }
      : {}
  return { ...(node as Record<string, unknown>), children: pruned, ...alignedPanels }
}

/** Prune `responsive.<bp>.children` for every breakpoint that declares any. */
function pruneResponsiveChildren(node: object, rule: PruneRule): object {
  const { responsive } = node as { readonly responsive?: unknown }
  if (typeof responsive !== 'object' || responsive === null) return node
  const entries = Object.entries(responsive as Record<string, unknown>)
  const pruned = entries.map(([breakpoint, variant]) => {
    const { children } = (variant ?? {}) as { readonly children?: readonly unknown[] }
    if (!Array.isArray(children) || children.length === 0) return [breakpoint, variant] as const
    const kept = pruneNodes(children, rule)
    return isSameList(kept, children)
      ? ([breakpoint, variant] as const)
      : ([breakpoint, { ...(variant as Record<string, unknown>), children: kept }] as const)
  })
  if (pruned.every(([, variant], i) => variant === entries[i]?.[1])) return node
  return { ...(node as Record<string, unknown>), responsive: Object.fromEntries(pruned) }
}

/**
 * Removes every component whose `condition` / `when` / `roles` gate excludes
 * the current session, with its whole subtree, at any depth.
 *
 * ─── WHY EXCLUSION, NOT `display: none` ────────────────────────────────────
 *
 * These gates are access controls. A node styled `display: none` still ships
 * its text in the response, so find-in-page, view-source, a copy of the page
 * and every reader that ignores the stylesheet received the salary figure the
 * gate was written to withhold. Nothing on the client re-shows such a node, so
 * there is nothing a hidden copy could be kept for.
 *
 * ─── WHY IT RECURSES ───────────────────────────────────────────────────────
 *
 * A gated block is usually inside the layout container that frames it; a gate
 * that stops applying at depth 2 validates and does nothing, which is the
 * worst failure an access control has. Nodes carrying no gate are returned by
 * reference, so an ungated page pays one walk and no copy.
 */
export function applyVisibilityToComponents(
  components: Page['components'],
  session: SessionInfo | undefined,
  app: App
): Page['components'] {
  if (!components) return components
  return pruneNodes(components, {
    keep: (node) => isNodeVisibleForSession(node, session, app),
  }) as Page['components']
}

/**
 * Removes every overlay whose triggers were ALL removed by the gates above.
 *
 * An overlay (dialog, drawer, popover) that an author opens by id is part of
 * the affordance its trigger offers: a create form behind an admin-only
 * button is as much the admin's as the button is. So when the gates leave a
 * viewer none of the triggers that addressed an overlay in the authored page,
 * the overlay goes with them — absent from the HTML, exactly as a gated
 * component is, never rendered and hidden. An overlay's own `visibility` still
 * applies on top (the gates already ran over it), so the two compose as AND.
 *
 * An overlay no trigger addresses (opened by a record binding, or always
 * open) is not touched: it was never an affordance of a trigger.
 *
 * @param authored - the tree BEFORE the gates, which names every trigger
 * @param gated - the tree AFTER them, which names the triggers this viewer keeps
 */
export function applyOverlayTriggerGate(
  authored: Page['components'],
  gated: Page['components']
): Page['components'] {
  if (!gated) return gated
  const addressed = collectOverlayTargets(authored)
  if (addressed.size === 0) return gated
  const kept = collectOverlayTargets(gated)
  const orphaned = new Set([...addressed].filter((id) => !kept.has(id)))
  if (orphaned.size === 0) return gated
  return pruneNodes(gated, {
    keep: (node) => {
      const id = overlayIdOf(node)
      return id === undefined || !orphaned.has(id)
    },
  }) as Page['components']
}

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
 * A power gate must never leave markup in the response: a CSS-hidden
 * action column still ships every row action's endpoint to a caller forbidden
 * to call it (rule S1/S4), and a greyed-out control advertises a power the
 * admin-route middleware answers with 404. So an unmet capability removes the
 * node entirely — the strategy `condition` already uses.
 *
 * ─── WHY IT RECURSES ───────────────────────────────────────────────────────
 *
 * The affordances a capability gate exists to hide — an action column, an
 * Invite button — sit inside the layout containers a console page is built
 * from, and a gate that silently stops applying at depth 2 is the same
 * "validates and does nothing" failure the root/props widening above fixes.
 * A node carrying no `capability` is returned by reference.
 *
 * Composition with `when` / `roles` / `condition` is AND, and it is ordered:
 * this pass runs first, so a component whose capability IS met still goes on to
 * be excluded by the other three exactly as before.
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
    keep: (node) => isCallerGateMet(node, ctx),
    reshape: (node) => gateColumns(node, ctx),
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
  const { capability } = visibility
  if (capability !== undefined && !holdsCapability(ctx, capability)) return false
  if (!queryGateMet(visibility, ctx.queryValues)) return false
  if (!runtimeGateMet(visibility, ctx.runnable)) return false
  return hostDeclarationMet(visibility, ctx.hostApp)
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
