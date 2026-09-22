/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import {
  computeSidebarDisclosureChevronClasses,
  computeSidebarEntryBadgeClasses,
  computeSidebarToggleChevronSlotClasses,
  computeSidebarToggleLabelClasses,
  computeSidebarToggleRowClasses,
} from '@/presentation/design/sidebar-default-classes'
// The live-count component, imported as a COMPONENT and not mounted as an
// island. A nested `data-island` marker would be the other way to reach it, and
// it is the wrong one: the mount pass scans the document ONCE, so a marker an
// island renders after that pass is never seen — and a later scan (an admin SPA
// swap re-scanning `document.body`) would find it and `createRoot` inside a
// subtree React already owns. Calling the component is what the server marker
// ends up doing anyway, one step earlier.
import SidebarBadgeIsland from './sidebar-badge-island'
import type { LeafBadge, SidebarDisclosureIslandProps } from './sidebar-disclosure-props'

/**
 * The pieces a disclosure draws that are not the LIST — split out of
 * `sidebar-disclosure-island.tsx` only so that file stays under the per-island
 * `max-lines` cap, which is a payload target rather than a style preference.
 *
 * Every class comes from `@/presentation/design/sidebar-default-classes`, the
 * same module the server-rendered half calls. That module exists because
 * `eslint-plugin-boundaries` forbids an island from reaching a
 * `presentation-component`, so the vocabulary the two halves share has exactly
 * one home and these strings are not a hand-copy of the server's.
 */

/** The direction mark both shapes of toggle carry, rotated while open. */
export function Chevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={computeSidebarDisclosureChevronClasses(expanded)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 16 16"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

/**
 * A row's marker: a literal written as-is, or the live count read from an
 * endpoint.
 *
 * The hydrated twin of `renderBadge` in the SSR half, and deliberately the same
 * two branches: the `<span>` carries the badge recipe either way, so the count
 * component contributes the number and nothing else rather than nesting a second
 * badge inside the first.
 *
 * `aria-hidden` for the reason the server half gives at length: a nav entry's
 * accessible name answers "where am I" and every deep link resolves by it, so a
 * count arriving after hydration must not rename the link mid-session.
 */
export function ChildBadge({ badge }: { readonly badge: LeafBadge | undefined }) {
  if (badge === undefined) return undefined
  return (
    <span
      aria-hidden="true"
      className={computeSidebarEntryBadgeClasses()}
    >
      {typeof badge === 'string' ? (
        badge
      ) : (
        <SidebarBadgeIsland
          endpoint={badge.endpoint}
          valuePath={badge.valuePath ?? 'total'}
        />
      )}
    </span>
  )
}

/**
 * The OTHER shape of toggle: the whole row, for an entry with no destination.
 *
 * The hydrated twin of `renderToggleRow` in the SSR half, and it exists for the
 * reason that half explains — a toggle row has no anchor outside the island
 * host, so this component redraws the icon, the label, the badge and the
 * authored attributes along with the control itself. A version that drew only
 * the chevron would replace a complete row with a bare arrow the moment the
 * chunk landed: correct without JavaScript and broken with it.
 *
 * No `aria-label`, no `aria-current`. The row is named by the words on it, and
 * it is not a page — both invariants stated in full on the SSR half.
 */
export function ToggleRow({
  expanded,
  onToggle,
  props,
}: {
  readonly expanded: boolean
  readonly onToggle: () => void
  readonly props: SidebarDisclosureIslandProps
}) {
  const { entryProps, iconNode, label, listId, rail } = props
  return (
    // Authored bag first, so the renderer-owned attributes written after it
    // cannot be displaced — the ordering every entry renderer here uses.
    <button
      {...(entryProps ?? {})}
      aria-controls={listId}
      aria-expanded={expanded}
      className={computeSidebarToggleRowClasses()}
      onClick={onToggle}
      type="button"
      {...(rail !== true || entryProps?.['title'] !== undefined ? {} : { title: label })}
    >
      {iconNode !== undefined && (
        <LucideGlyph
          iconNode={iconNode}
          size={16}
        />
      )}
      <span className={computeSidebarToggleLabelClasses()}>{label}</span>
      <ChildBadge badge={props.badge} />
      <span className={computeSidebarToggleChevronSlotClasses()}>
        <Chevron expanded={expanded} />
      </span>
    </button>
  )
}
