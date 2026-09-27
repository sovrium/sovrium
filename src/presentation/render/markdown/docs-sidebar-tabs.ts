/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Docs navigation tabs (zones) — resolution helpers over the tabs an APP
 * declares in `contentDir.nav.tabs`.
 *
 * The engine ships NO information architecture of its own. This module used to
 * hardcode one app's IA (a closed `TabId` union plus `TAB_ORDER` /
 * `TAB_FOR_SECTION` / `TAB_LABELS` keyed by Sovrium-website section slugs), which
 * every docs-layout app inherited with no way to override. All of that now comes
 * from config; what remains here is the pure resolution logic:
 *
 *   - which tab owns a given `groupBy` section slug (unclaimed → the FIRST tab,
 *     so an IA gap never makes an article unreachable), and
 *   - a tab's display label (`label`, else the id humanized to Title Case —
 *     the same fallback `groupLabels` / `groupIcons` use), and
 *   - the sidebar's reading ORDER (`bucketByGroup`, `groupsForTab`,
 *     `orderSidebarEntries`), which the docs sidebar renders and the content-dir
 *     lister walks for previous / next — one ordering, so the two never disagree.
 *
 * A tab's `id` is announced verbatim on the docs sidebar wrapper
 * (`data-docs-active-zone`); the app owns its own tab-strip markup and matches on
 * that value. The platform renders no tab strip itself.
 */
import { humanizeFieldName } from '@/presentation/design/string-utils'
import type {
  CollectionNavEntry,
  CollectionNavTabs,
} from '@/presentation/render/resolve/content-dir-lister'

/** A single declared docs tab (one element of `contentDir.nav.tabs`). */
export type DocsNavTab = CollectionNavTabs[number]

/**
 * Whether a collection declares a docs tab IA at all. Drives the zoned/untabbed
 * split: no tabs ⇒ the historical flat expanded sidebar, no zone announcement,
 * and the "Home" breadcrumb root.
 */
export const hasDocsTabs = (tabs: CollectionNavTabs | undefined): tabs is CollectionNavTabs =>
  tabs !== undefined && tabs.length > 0

/** Whether a section slug is claimed by ANY declared tab. */
export const sectionIsClaimed = (name: string | undefined, tabs: CollectionNavTabs): boolean =>
  name !== undefined && tabs.some((tab) => tab.sections.includes(name))

/**
 * Resolve the tab owning a section slug. An unclaimed (or absent) section falls
 * back to the FIRST declared tab — the schema's "never dropped" guarantee.
 * Returns `undefined` only for an empty tab list.
 */
export const tabOfSection = (
  name: string | undefined,
  tabs: CollectionNavTabs
): DocsNavTab | undefined => {
  const owner = name === undefined ? undefined : tabs.find((tab) => tab.sections.includes(name))
  return owner ?? tabs[0]
}

/**
 * A tab's display label: the configured `label` (supplied ALREADY LOCALISED per
 * locale, the `groupLabels` convention), else the id humanized to Title Case
 * ("api-reference" → "Api Reference").
 */
export const getTabLabel = (tab: DocsNavTab): string => tab.label ?? humanizeFieldName(tab.id)

export interface NavGroup {
  /** Raw `groupBy` key used as the section identifier (`data-nav-group`). */
  readonly name: string | undefined
  /** Resolved display label (groupLabels override or humanized key). */
  readonly label: string | undefined
  /** Configured Lucide icon name (`nav.groupIcons[group]`), undefined if unset. */
  readonly icon: string | undefined
  readonly entries: readonly CollectionNavEntry[]
}

/**
 * Bucket entries by `group` (preserving insertion order). When `groupBy` is
 * unset every entry has `group === undefined`, collapsing into a single
 * implicit "default" bucket — the renderer then omits the `[data-nav-group]`
 * wrapper so spec 080 still passes (the ungrouped flat-list case).
 *
 * Each bucket carries the resolved `label` (from the first entry's
 * `groupLabel`, which the lister derives from `nav.groupLabels` or a
 * humanized fallback) so the section heading shows the display label, never
 * the raw key. The `icon` (from the first entry's `groupIcon`, derived from
 * `nav.groupIcons`) drives the decorative leading glyph; undefined renders
 * label-only.
 */
export const bucketByGroup = (entries: readonly CollectionNavEntry[]): readonly NavGroup[] => {
  const orderedNames = entries.reduce<readonly string[]>((acc, entry) => {
    const name = entry.group
    if (name === undefined) return acc
    if (acc.includes(name)) return acc
    return [...acc, name]
  }, [])
  const grouped = orderedNames.map((name) => {
    const groupEntries = entries.filter((entry) => entry.group === name)
    return {
      name,
      label: groupEntries[0]?.groupLabel ?? name,
      icon: groupEntries[0]?.groupIcon,
      entries: groupEntries,
    }
  })
  const ungrouped = entries.filter((entry) => entry.group === undefined)
  if (ungrouped.length === 0) return grouped
  // Mix ungrouped entries in only when no groups exist (homogeneous flat list).
  if (grouped.length === 0)
    return [{ name: undefined, label: undefined, icon: undefined, entries: ungrouped }]
  return [...grouped, { name: undefined, label: undefined, icon: undefined, entries: ungrouped }]
}

/**
 * The groups a declared tab renders, in order: its `sections` array drives the
 * group order WITHIN the tab (orthogonal to `contentDir.sort`, which orders the
 * links inside each group). The FIRST tab additionally adopts every group no tab
 * claims — appended after its declared sections, in sidebar order — so an IA gap
 * can never make an article unreachable through the sidebar.
 */
export const groupsForTab = (
  groups: readonly NavGroup[],
  tab: DocsNavTab,
  tabs: CollectionNavTabs,
  isFirst: boolean
): readonly NavGroup[] => {
  const declared = tab.sections.flatMap((section) =>
    groups.filter((group) => group.name === section)
  )
  if (!isFirst) return declared
  return [...declared, ...groups.filter((group) => !sectionIsClaimed(group.name, tabs))]
}

/**
 * The collection's entries in the order the docs sidebar lists them, for the
 * previous / next links at the foot of each article. Mirrors `DocsSidebarNav`: groups in first-appearance sort order,
 * entries in sort order within each group, ungrouped entries last. When the
 * sidebar is zoned (declared tabs, not collapsed) the walk runs tab by tab in
 * declared order, each tab contributing its `groupsForTab` groups — so the last
 * article of one group, or of one tab, leads to the first of the next. An entry
 * reachable through two tabs keeps its first position.
 */
export const orderSidebarEntries = (
  entries: readonly CollectionNavEntry[],
  tabs: CollectionNavTabs | undefined,
  collapsed: boolean
): readonly CollectionNavEntry[] => {
  const groups = bucketByGroup(entries)
  const orderedGroups =
    !collapsed && hasDocsTabs(tabs)
      ? tabs.flatMap((tab) => groupsForTab(groups, tab, tabs, tab === tabs[0]))
      : groups
  return orderedGroups
    .flatMap((group) => group.entries)
    .filter((entry, index, all) => all.findIndex((other) => other.slug === entry.slug) === index)
}
