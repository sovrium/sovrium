/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeSidebarDisclosureChevronClasses,
  computeSidebarDisclosureToggleClasses,
  computeSidebarEntryBadgeClasses,
  computeSidebarToggleChevronSlotClasses,
  computeSidebarToggleLabelClasses,
  computeSidebarToggleRowClasses,
  type SidebarRailBreakpoint,
} from '@/presentation/design/sidebar-default-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import { renderIcon } from '../elements/icon-renderer'
import type { SidebarNavItem } from '@/domain/models/app/pages/components/component-types/layout/sidebar'

/**
 * The PIECES a sidebar row is assembled from, split out of `sidebar-entry.tsx`
 * only so that file stays under its per-file `max-lines` cap.
 *
 * Nothing here resolves a translation, which is what makes the split one-way:
 * `sidebar-entry.tsx` owns `SidebarI18n` and hands every user-facing string in
 * already resolved, so this module never needs to import back from it.
 */

/** The server-resolved state a disclosure both renders and hands to its island. */
export interface DisclosureState {
  readonly listId: string
  readonly label: string
  readonly expandLabel: string
  readonly collapseLabel: string
  readonly expanded: boolean
  readonly sectionCurrent: boolean
  /** The breakpoint below which the surrounding sidebar is a rail, if any. */
  readonly rail?: SidebarRailBreakpoint
}

/**
 * The tooltip a rail hangs on a row, or nothing.
 *
 * `title` and not `aria-label`: an `aria-label` REPLACES the accessible name,
 * and the label text is still in the document — so the row would end up named
 * twice, by two strings that an author renaming one of them could drift apart.
 * An author's own `title` always wins, which is why this reads the authored bag
 * rather than trusting the spread order alone.
 */
export const railTitle = (
  rail: SidebarRailBreakpoint | undefined,
  label: string,
  authoredTitle: unknown
): Readonly<Record<string, string>> =>
  rail === undefined || authoredTitle !== undefined ? {} : { title: label }

/**
 * The entry's marker: a literal string server-rendered as-is, or the island
 * host for a count only the live instance knows.
 *
 * ─── WHY THE BADGE IS OUTSIDE THE ACCESSIBLE NAME ──────────────────────────
 *
 * A nav entry's accessible name is what answers "where am I" and what every
 * deep link resolves by, so it has to be STABLE. A fetched count arrives after
 * hydration; leaving it inside the name would rename the link mid-session, from
 * "Tables" to "Tables 12", and rename it again whenever the count moved. The
 * count is still rendered and still visible; it is the entry's metadata, not
 * its identity.
 */
export function renderBadge(badge: SidebarNavItem['badge']): ReactElement | undefined {
  if (badge === undefined) return undefined
  if (typeof badge === 'string') {
    return (
      <span
        aria-hidden="true"
        className={computeSidebarEntryBadgeClasses()}
      >
        {badge}
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={computeSidebarEntryBadgeClasses()}
      data-island="sidebar-badge"
      data-island-props={JSON.stringify({
        endpoint: badge.endpoint,
        valuePath: badge.valuePath ?? 'total',
      })}
    />
  )
}

/** The chevron, server-rendered so the shut toggle is complete without JavaScript. */
function renderChevron(expanded: boolean): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={computeSidebarDisclosureChevronClasses(expanded)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

/**
 * The small chevron beside a LINKED parent.
 *
 * It needs an accessible name of its own because the words on the row belong to
 * the link: "Files" says where the anchor goes and nothing about what the
 * control does. The `{label}` placeholder is what keeps that name specific to
 * this one disclosure rather than shared by every disclosure in the sidebar.
 */
export function renderChevronToggle(state: DisclosureState): ReactElement {
  return (
    <button
      aria-controls={state.listId}
      aria-expanded={state.expanded}
      aria-label={(state.expanded ? state.collapseLabel : state.expandLabel).replaceAll(
        '{label}',
        state.label
      )}
      className={computeSidebarDisclosureToggleClasses()}
      type="button"
    >
      {renderChevron(state.expanded)}
    </button>
  )
}

/**
 * The whole row, server-rendered as ONE toggle — an entry declaring no `href`.
 *
 * ─── WHY THIS ROW IS INSIDE THE ISLAND WHEN A LINKED ONE IS NOT ────────────
 *
 * A linked parent keeps its anchor outside the island host, so the destination
 * never waits on a chunk. A toggle has no destination to protect: its only
 * behaviour IS opening the list, which is the thing that cannot work without
 * JavaScript. Rendering it outside would leave the island with a second button
 * to draw and the row with two controls governing one list — the exact shape
 * this replaces.
 *
 * So the button sits in the host, and this is the fallback the island will
 * overwrite: a complete, correctly-named toggle carrying the right state, and —
 * when the reader arrived inside this section — the open list beside it with its
 * current child already marked.
 *
 * No `aria-label`. The row's accessible name is the words already on it, read
 * with the state `aria-expanded` announces; a second string here would shadow
 * them, and an author renaming one could drift the two apart. `expandLabel` and
 * `collapseLabel` name the chevron beside a LINK, which is why the decoder
 * refuses them on this shape rather than ignoring them.
 */
export function renderToggleRow(item: SidebarNavItem, state: DisclosureState): ReactElement {
  const authoredTitle = (item.props as Record<string, unknown> | undefined)?.['title']
  return (
    // The authored bag is spread FIRST, exactly as the anchor spreads it, so no
    // attribute the renderer owns can be displaced by config.
    <button
      {...(item.props ?? {})}
      aria-controls={state.listId}
      aria-expanded={state.expanded}
      className={computeSidebarToggleRowClasses()}
      type="button"
      {...railTitle(state.rail, state.label, authoredTitle)}
    >
      {item.icon !== undefined &&
        renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])}
      <span className={computeSidebarToggleLabelClasses()}>{state.label}</span>
      {renderBadge(item.badge)}
      <span className={computeSidebarToggleChevronSlotClasses()}>
        {renderChevron(state.expanded)}
      </span>
    </button>
  )
}

/**
 * The three things a TOGGLE row hands its island that a linked parent does not.
 *
 * A linked parent's icon, badge and authored attributes stay in the anchor the
 * server rendered outside the host, so none of them crosses the wire. A toggle
 * has no such anchor — the whole row is the button, the button is inside the
 * host, and the island redraws it — so leaving any of the three behind would not
 * save bytes but delete the row's icon, its count and its `data-testid` the
 * moment the chunk landed.
 *
 * The icon travels as GEOMETRY and not as a name: resolving by name in the
 * browser means reaching `lucide-resolver`, whose namespace import is
 * unshakeable and costs 668 KB. The bag is named `entryProps` rather than
 * `props` because island props are spread onto the component, and a key called
 * `props` would read as one more prop rather than as the row's own attributes.
 */
export const toggleRowPayload = (item: SidebarNavItem): Record<string, unknown> => ({
  ...(item.icon === undefined ? {} : { iconNode: resolveLucideIconNode(item.icon) }),
  ...(item.badge === undefined ? {} : { badge: item.badge }),
  ...(item.props === undefined ? {} : { entryProps: item.props }),
})
