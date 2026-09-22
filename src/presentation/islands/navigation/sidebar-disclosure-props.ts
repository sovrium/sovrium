/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RowProjection } from './sidebar-entry-projection'
import type { LucideIconNode } from '@/presentation/design/lucide-icon-node'

/**
 * A row's marker, in the two shapes the schema allows: a literal string, or the
 * read endpoint a live count comes from.
 *
 * BOTH branches cross the wire, because both belong to a row the island
 * RE-RENDERS. The server draws the badge into its own markup and the island then
 * replaces that markup from these props, so a payload carrying only the literal
 * would drop every fetched count the moment the chunk landed — and a payload
 * carrying neither drops both.
 */
export type LeafBadge =
  string | { readonly endpoint: string; readonly valuePath?: string | undefined }

/**
 * One authored row of a disclosure's list, at either level below the entry.
 *
 * The LEAF shape — everything a row needs to be drawn and to answer "am I the
 * current page". {@link SubItem} adds the one thing a leaf cannot have.
 */
export interface LeafItem {
  readonly label: string
  readonly href: string
  readonly activeMatch?: string
  /**
   * This row's marker, carried through hydration.
   *
   * `badge` sits on the entry bag EVERY sidebar level spreads, so it is
   * declarable on a row at any depth — and a row at depth is a row this island
   * redraws. Omitting it here is therefore not a smaller payload but a
   * disappearing badge: server-rendered correctly, then deleted by the chunk
   * that was supposed to make the list work.
   */
  readonly badge?: LeafBadge
  /**
   * The icon's GEOMETRY, not its name.
   *
   * Resolving by name needs `lucide-resolver`, whose namespace import is
   * unshakeable and pulls 668 KB of icon set into the browser. The server
   * resolves it — where the set is in the binary already — and serializes the
   * `[tag, attrs][]` array here.
   */
  readonly iconNode?: LucideIconNode
  readonly props?: Readonly<Record<string, unknown>>
  /** The server's verdict, used verbatim by a sidebar that does not track. */
  readonly current?: boolean
}

/** One authored sub-entry, as the server hands it to the island. */
export interface SubItem extends LeafItem {
  /**
   * This row's OWN nested list — the third level, always open and toggle-less.
   *
   * Named `subItems` and never `children` for the reason
   * {@link SidebarDisclosureIslandProps.subItems} gives: island props are spread
   * onto the component, and a `children` key would be read by React as the
   * element's own children.
   *
   * It has to cross the wire at all because the level-2 disclosure IS an island:
   * the island re-renders this list from its props, so a payload that stopped at
   * the leaves would drop the third level on hydration — server-rendered
   * correctly, then deleted by the chunk that was supposed to make it work.
   */
  readonly subItems?: readonly LeafItem[]
  /** Attributes for this row's own nested list; a leaf's `props` names one row. */
  readonly childrenProps?: Readonly<Record<string, unknown>>
}

/** A disclosure's fetched source, with its three states' copy already resolved. */
export interface DisclosureSource extends RowProjection {
  readonly endpoint: string
  readonly rowsKey: string
  /**
   * Static query params merged into the request — this entry's own filter.
   *
   * An entry source spreads the same shared system source a GROUP source does,
   * so `query` decodes on it and an author can narrow a disclosure's children
   * exactly as they narrow a group's. It has to cross the wire for the reason
   * the group's does: the fetch happens in the browser, so a param that stops
   * at the server narrows nothing and the entry quietly lists everything.
   */
  readonly query?: Readonly<Record<string, string | number | boolean>>
  readonly loadingLabel: string
  readonly errorLabel: string
  readonly emptyLabel: string
}

/**
 * What `renderDisclosureEntry` serializes into `data-island-props`.
 *
 * Every user-facing string arrives RESOLVED — `$t:` keys are expanded on the
 * server — so the island carries no translation machinery, and the toggle names
 * still hold their `{label}` placeholder because which of the two applies
 * depends on a state only the island knows.
 */
export interface SidebarDisclosureIslandProps {
  readonly listId: string
  readonly label: string
  /**
   * The entry's destination — ABSENT when the whole row is the toggle.
   *
   * Optional here because it is optional in the schema at this one level: a
   * parent that is not itself a page declares no `href`, and the row then goes
   * nowhere at all. What follows from that is the rest of this block — such a
   * row has no anchor beside the host, so this island draws it, which is why
   * {@link iconNode}, {@link badge} and {@link entryProps} exist.
   */
  readonly href?: string
  /**
   * The row's OWN icon geometry, for a toggle that draws its whole row.
   *
   * Geometry and not a name, for the reason {@link LeafItem.iconNode} gives:
   * resolving by name means reaching `lucide-resolver`, whose namespace import
   * is unshakeable and costs the browser 668 KB.
   */
  readonly iconNode?: LucideIconNode
  /** The row's own marker, for a toggle. A linked parent's stays in its anchor. */
  readonly badge?: LeafBadge
  /**
   * The row's own authored attribute bag, for a toggle.
   *
   * Named `entryProps` and never `props`: island props are spread onto the
   * component, so a key called `props` would arrive as one more prop rather than
   * as the attributes belonging to the row. It has to cross the wire at all
   * because the island REDRAWS this button — a payload without it would serve a
   * correctly-identified row until the chunk landed and an anonymous one after.
   */
  readonly entryProps?: Readonly<Record<string, unknown>>
  readonly activeMatch?: string
  readonly expandLabel: string
  readonly collapseLabel: string
  /** The server-resolved initial state: `defaultExpanded`, or the current section. */
  readonly expanded: boolean
  readonly sectionCurrent: boolean
  /** Whether the sidebar opted into client-side navigation tracking. */
  readonly track?: boolean
  /**
   * Authored sub-entries. Named `subItems` and never `children`: island props
   * are spread onto the component, so a `children` key would be read by React as
   * the element's own children and the sub-entries would render as raw objects.
   */
  readonly subItems?: readonly SubItem[]
  readonly childrenProps?: Readonly<Record<string, unknown>>
  readonly source?: DisclosureSource
  /**
   * Whether the sidebar this disclosure belongs to is a rail below some
   * breakpoint.
   *
   * Everything a rail PAINTS is a descendant rule on the navigation root, which
   * reaches the rows this island draws exactly as it reaches the server's. The
   * tooltip is the one part that cannot travel that way — it is an attribute,
   * not a paint — so it travels here. Absent unless a rail is declared.
   */
  readonly rail?: boolean
}
