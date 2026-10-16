/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sessionHoldsCapability } from '@/domain/models/app/pages/component-session-visibility-service'
import {
  normalizeSidebarPath,
  sidebarEntryMatches,
} from '@/domain/models/app/pages/sidebar-active-match'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Who is reading, for an entry gated by `capability`: the session the powers
 * derive from, or — on a mounted console page, which renders session-less —
 * the powers the mount already resolved (`granted`), which win when present.
 */
export interface SidebarCaller {
  readonly session: SessionInfo | undefined
  readonly app: App
  readonly granted?: readonly CallerCapability[] | undefined
}

/** Whether the caller holds a power: the stated set when there is one, else the session's. */
type HoldsPower = (capability: string) => boolean

/** The request an entry is judged against: where the reader is, and what they may do. */
interface Scope {
  readonly fullPath: string
  readonly holds: HoldsPower
}

const holdsPower =
  (caller: SidebarCaller | undefined): HoldsPower =>
  (capability) => {
    if (caller === undefined) return false
    const power = capability as CallerCapability
    return caller.granted !== undefined
      ? caller.granted.includes(power)
      : sessionHoldsCapability(power, caller.session, caller.app)
  }

/**
 * Drop every sidebar entry whose `showWhen` section the reader is not inside.
 *
 * ─── WHY IT RUNS HERE AND NOT IN THE RENDERER ──────────────────────────────
 *
 * The gate reads the REQUEST PATH, and the request path is deliberately not
 * threaded through the component dispatcher — `render-page.tsx` states that
 * invariant where it resolves the derived breadcrumbs and the current entry for
 * exactly the same reason. Adding a prop to the
 * `DynamicPage → PageMain → SectionRenderer → ComponentRenderer` chain would
 * touch six files and be inert for every component but this one.
 *
 * So this is a third pre-render pass beside {@link resolveSidebarCurrentEntries}
 * rather than a fold into it, because the two answer different questions and one
 * of them can delete its input. Keeping them apart also keeps the marking walk
 * reading exactly what it read before: it now runs over a tree the gate has
 * already pruned, so a removed entry cannot carry a current mark into a
 * document it is not in.
 *
 * ─── IT REMOVES, IT DOES NOT HIDE ──────────────────────────────────────────
 *
 * A gated entry is absent from the rendered document, the way `visibility.query`
 * is absent rather than CSS-hidden. A navigation that ships every row and hides
 * most of them is one whose landmark, tab order and screen-reader reading all
 * disagree with what is on the screen — and `aria-current`, which is what a
 * screen reader is actually told, would be resolvable onto a row nobody can see.
 *
 * The predicate is `sidebarEntryMatches(section, 'prefix', …)`, reused rather
 * than reinvented: one prefix rule in this product, so the gate and the
 * current-entry mark cannot come to disagree about what "inside this section"
 * means. `prefix` is passed literally because that IS the semantics the schema
 * documents — `showWhen` carries no `activeMatch` of its own.
 *
 * Pure, and a page with no gated entry is returned by reference.
 */
export function resolveSidebarScopedEntries(
  page: Page,
  requestPath: string,
  basePath?: string,
  caller?: SidebarCaller
): Page {
  if (!hasScopedEntry(page.components) && !hasScopedEntry(page.layout)) return page
  const holds = holdsPower(caller)
  // Compared in the MOUNT's own space, exactly as the current-entry pass is:
  // `showWhen.section` is rewritten onto the base at boot by the same walk that
  // rewrites every href beside it, while the path this function receives has had
  // that base stripped.
  const scope: Scope = { fullPath: normalizeSidebarPath(`${basePath ?? ''}${requestPath}`), holds }
  return {
    ...page,
    ...(page.components !== undefined
      ? { components: transform(page.components, scope) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: transform(page.layout, scope) as Page['layout'] }
      : {}),
  }
}

/**
 * Cheap pre-check so a page with no gate is never deep-copied.
 *
 * Keyed on `showWhen` rather than on `type === 'sidebar'`, which is the tighter
 * test: most sidebars carry no gate at all, and those pay one shallow walk
 * instead of a full rebuild of their component tree.
 */
function hasScopedEntry(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasScopedEntry)
  if (!isRecord(value)) return false
  if (isRecord(value['showWhen']) || typeof value['capability'] === 'string') return true
  return Object.values(value).some(hasScopedEntry)
}

function transform(value: unknown, scope: Scope): unknown {
  if (Array.isArray(value)) return value.map((entry) => transform(entry, scope))
  if (!isRecord(value)) return value

  const mapped = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, transform(child, scope)])
  )
  if (value['type'] !== 'sidebar' || !Array.isArray(value['groups'])) return mapped

  return { ...mapped, groups: scopeGroups(value['groups'], scope) }
}

function scopeGroups(groups: readonly unknown[], scope: Scope): readonly unknown[] {
  return groups.map((group) => {
    if (!isRecord(group) || !Array.isArray(group['items'])) return group
    return { ...group, items: scopeEntries(group['items'], scope) }
  })
}

/**
 * Keep the entries the reader is in the section of, at EVERY level.
 *
 * `showWhen` is a field of the shared entry bag, so it is available on a
 * top-level entry, a sub-entry and a leaf alike — and the recursion is what
 * makes that true in fact rather than only in the schema. The console's own
 * case needs both ends of it: a top-level `Tokens` scoped to `/design`, and the
 * twelve kit categories scoped one segment deeper.
 *
 * A parent that survives keeps a `children` array with its own survivors. A
 * parent that is dropped takes its subtree with it, which needs no special
 * case: the entry is gone and nothing walks into it.
 *
 * `children` is rebuilt only when it was there, so an ungated tree comes out
 * shaped exactly as it went in — an empty `children: []` would turn a plain
 * entry into an expandable one with nothing in it.
 */
function scopeEntries(entries: readonly unknown[], scope: Scope): readonly unknown[] {
  return entries
    .filter((entry) => isInScope(entry, scope))
    .map((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry['children'])) return entry
      const children = scopeEntries(entry['children'], scope)
      // Every child gated out leaves a list with nothing in it. The field is
      // dropped rather than published empty, so the row degrades to the plain
      // link it would have been — a disclosure whose toggle opens onto nothing
      // is a control with no purpose, and at the third level an empty `<ul>` is
      // markup a reader tabs into and finds nothing.
      return children.length === 0
        ? Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'children'))
        : { ...entry, children }
    })
}

/** Whether an entry declares no gate, or only gates the reader passes. */
function isInScope(entry: unknown, scope: Scope): boolean {
  if (!isRecord(entry)) return true
  // A power the reader lacks removes the entry, and its subtree with it — the
  // same predicate the route behind it applies, so the navigation never offers
  // a destination the server would answer with a 404.
  if (typeof entry['capability'] === 'string' && !scope.holds(entry['capability'])) return false
  const { showWhen } = entry
  if (!isRecord(showWhen)) return true
  const { section } = showWhen
  return typeof section !== 'string' || sidebarEntryMatches(section, 'prefix', scope.fullPath)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
