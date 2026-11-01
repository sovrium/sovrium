/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component-level visibility filtering for the page renderer.
 *
 * EVERY gate excludes — none of them hides with CSS:
 *   - `capability` — fully exclude the component AND its subtree from the SSR
 *     output, based on what the CALLER may do (`applyCallerCapabilityGate`,
 *     in `caller-capability-gate.ts`). The same pass gates a data-table
 *     ACTION COLUMN, which carries its capability at its own root rather than
 *     under `visibility`.
 *   - `condition` / `when` / `roles` — fully exclude the component AND its
 *     subtree from the SSR output, at any depth (see
 *     {@link applyVisibilityToComponents}).
 *   - every gate above also judges a `command`'s authored groups and items.
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
  visibilityOf,
  type SessionVisibility,
} from '@/domain/models/app/pages/component-session-visibility-service'
import { gateCommandRows } from '@/presentation/render/resolve/command-row-gate'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { pruneFooterSlot } from '@/presentation/render/resolve/mounted-write-gate'
import { collectOverlayTargets, overlayIdOf } from '@/presentation/render/resolve/overlay-triggers'
import { labelsFollowingChildren } from '@/presentation/render/resolve/record-visibility'
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
export interface VisibilityConfig extends SessionVisibility {
  /** Rendered only when the HOST app declares this capability. */
  readonly declares?: PageCapability
  /** Rendered only when the HOST app does NOT declare this capability. */
  readonly unlessDeclares?: PageCapability
  readonly unlessCapability?: CallerCapability
  /**
   * Rendered only when the capability can actually RUN here — the host app
   * declares it AND the environment can serve it. Resolved once per request by
   * the caller; see `runtimeGateMet` in `caller-capability-gate.ts`.
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
export const extractVisibility = (node: unknown): VisibilityConfig | undefined =>
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
export interface PruneRule {
  readonly keep: (node: unknown) => boolean
  readonly reshape?: (node: object) => object
}

/** Same length and same elements by reference — the "nothing changed" test. */
function isSameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

/** Keep what `rule` admits from one list, then walk into whatever survives. */
export function pruneNodes(nodes: readonly unknown[], rule: PruneRule): readonly unknown[] {
  return nodes.filter(rule.keep).map((node) => pruneNode(node, rule))
}

/**
 * Walk a SURVIVING node: reshape it, then prune its `children`, every
 * `responsive` breakpoint's `children` and a sidebar's `footer`. A component
 * REFERENCE (inlined before these passes, so one still here has no subtree) and
 * a string child are returned as-is. Every position is walked because every one
 * is RENDERED server-side: a gated node a walk skipped would ship to every
 * reader — the exact leak exclusion exists to stop.
 */
function pruneNode(node: unknown, rule: PruneRule): unknown {
  if (typeof node !== 'object' || node === null) return node
  if (isComponentReferenceNode(node as Page['components'][number])) return node
  const reshaped = rule.reshape === undefined ? node : rule.reshape(node)
  const walked = pruneResponsiveChildren(pruneChildren(reshaped, rule), rule)
  return pruneFooterSlot(walked, (nodes) => pruneNodes(nodes, rule))
}

/**
 * Prune a node's `children`, keeping a `tabs` strip or a `stepper` rail aligned
 * with its bodies.
 *
 * `tabs.panels[i]` names the tab that shows `children[i]`, as `stepper.steps[i]`
 * names a step: the alignment is positional, and decode refuses the two at
 * different lengths. Dropping a gated body without dropping its label would
 * slide every later body under the wrong one and leave the last empty. So when
 * the two are aligned, a dropped child takes its label with it: a reader the
 * body is withheld from is not shown a label for it either.
 */
function pruneChildren(node: object, rule: PruneRule): object {
  const { children } = node as { readonly children?: readonly unknown[] }
  if (!Array.isArray(children) || children.length === 0) return node
  const pruned = children.flatMap((child) => (rule.keep(child) ? [pruneNode(child, rule)] : []))
  if (isSameList(pruned, children)) return node
  return {
    ...(node as Record<string, unknown>),
    children: pruned,
    ...labelsFollowingChildren(node, children as readonly unknown[], rule.keep),
  }
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
  const keep = (node: unknown) => isNodeVisibleForSession(node, session, app)
  return pruneNodes(components, {
    keep,
    reshape: (node) => gateCommandRows(node, keep),
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
