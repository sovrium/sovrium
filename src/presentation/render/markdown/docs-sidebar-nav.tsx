/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveLucideIcon } from '@/presentation/render/elements/lucide-resolver'
import {
  SIDEBAR_DRAWER_ROOT_ATTRIBUTE,
  SidebarDrawerFrame,
} from '@/presentation/render/registry/sidebar-drawer'
import {
  bucketByGroup,
  type DocsNavTab,
  groupsForTab,
  hasDocsTabs,
  type NavGroup,
} from './docs-sidebar-tabs'
import type {
  CollectionNavData,
  CollectionNavEntry,
  CollectionNavTabs,
} from '@/presentation/render/resolve/content-dir-lister'

/**
 * Decorative leading icon for a nav section, driven by config. The icon name
 * comes from the group's resolved `groupIcon` (`nav.groupIcons[group]`, surfaced
 * by the content-dir lister). Returns undefined when the section has no
 * configured icon or the name does not resolve to a real Lucide icon, so the
 * label renders on its own. Always `aria-hidden` (the label carries meaning).
 */
const renderSectionIcon = (iconName: string | undefined): Readonly<ReactElement> | undefined => {
  const LucideIcon = resolveLucideIcon(iconName)
  if (!LucideIcon) return undefined
  return (
    <LucideIcon
      aria-hidden="true"
      size={16}
      color="currentColor"
      strokeWidth={2}
      className="shrink-0"
    />
  )
}

/**
 * SSR sidebar nav rendered alongside the markdown article in the `docs`
 * layout.
 *
 * The sidebar groups entries by `contentDir.nav.groupBy` when set (so each
 * unique frontmatter value becomes a `[data-nav-group]` section); otherwise
 * it renders a single flat list. When the collection DECLARES its docs tabs
 * (`contentDir.nav.tabs`, [internal ref]), the sidebar renders ONLY the current
 * article's tab — the tab STRIP itself belongs to the app, not the platform —
 * and the wrapper announces the active tab id via `data-docs-active-zone` so the
 * app's tab-strip markup can mark the matching link `aria-current="page"`. A
 * collection declaring no tabs falls back to the flat expanded stack. The
 * wrapper is always `<nav data-component="docs-sidebar-nav"
 * aria-label="Documentation">` so spec selectors stay stable.
 */
interface DocsSidebarNavProps {
  readonly nav: CollectionNavData
  /** Accessible name of the menu button that opens the navigation below `lg`. */
  readonly menuLabel: string
}

const ENTRY_BASE_CLASS =
  'block rounded-md px-3 py-1.5 text-md transition-colors duration-150 border-l-2'
const ENTRY_ACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-border-strong bg-background-overlay font-medium text-foreground`
const ENTRY_INACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-transparent text-foreground-muted hover:bg-background-overlay/60 hover:text-foreground`

const renderEntry = (entry: CollectionNavEntry): Readonly<ReactElement> => (
  <li
    key={entry.slug}
    data-current={entry.isCurrent ? 'true' : undefined}
  >
    <a
      href={entry.href}
      aria-current={entry.isCurrent ? 'page' : undefined}
      className={entry.isCurrent ? ENTRY_ACTIVE_CLASS : ENTRY_INACTIVE_CLASS}
    >
      {entry.label}
    </a>
  </li>
)

/** A group is active when any of its entries is the current page. */
const groupIsActive = (group: NavGroup): boolean => group.entries.some((entry) => entry.isCurrent)

/*
  Non-heading group label: the label is rendered as a
  styled <p> (expanded mode) or inside a <summary> (collapsed mode), NEVER as an
  <h3>. Sidebar group labels must not compete with the article's own <h1> in the
  document outline — a heading here would add h2/h3 nodes to the page heading
  tree (WCAG 1.3.1 / 2.4.6). <summary> is interactive, not a heading, so it does
  not enter the heading outline either, keeping the single-h1 invariant intact.
  Display text is the resolved label (groupLabels override or humanized key).
*/
const GROUP_LABEL_CLASS =
  'mb-2 px-3 text-sm font-semibold tracking-wide text-foreground-subtle uppercase'

const renderGroup = (
  group: NavGroup,
  index: number,
  collapsed: boolean
): Readonly<ReactElement> => {
  if (group.name === undefined) {
    return (
      <ul
        key={`flat-${index}`}
        className="space-y-0.5"
      >
        {group.entries.map(renderEntry)}
      </ul>
    )
  }

  const list = <ul className="space-y-0.5">{group.entries.map(renderEntry)}</ul>

  // Collapsed mode: native <details>/<summary> — zero JS, only the active
  // group's <details> is `open` so a long docs tree stays scannable.
  if (collapsed) {
    return (
      <details
        key={group.name}
        data-nav-group={group.name}
        className="mb-3 [&>summary]:list-none"
        open={groupIsActive(group) ? true : undefined}
      >
        <summary
          className={`${GROUP_LABEL_CLASS} flex cursor-pointer items-center justify-between [&::-webkit-details-marker]:hidden`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {renderSectionIcon(group.icon)}
            {group.label}
          </span>
          <span
            aria-hidden="true"
            className="text-foreground-subtle ml-2 transition-transform duration-150"
          >
            ▾
          </span>
        </summary>
        <div className="mt-2">{list}</div>
      </details>
    )
  }

  // Default (expanded) mode: every group rendered open as a static section,
  // separated by a top divider (suppressed on the first section).
  return (
    <section
      key={group.name}
      data-nav-group={group.name}
      className="border-border mb-6 border-t pt-6 first:border-t-0 first:pt-0"
    >
      <p className={`${GROUP_LABEL_CLASS} flex items-center gap-2`}>
        {renderSectionIcon(group.icon)}
        {group.label}
      </p>
      {list}
    </section>
  )
}

// The sticky offset (`top-[6.5rem]` = 104px) matches the Sovrium two-row docs
// header height, measured live: the top navbar row (~61px) + the fused zone
// sub-nav row (~43px). This is the same Phase-1 coupling the single-row header
// used before the sub-nav landed (it was `top-16`, one 64px row) — the offset is
// measured against the live rendered header and revisited if the header's row
// heights change. The height budget subtracts the same 6.5rem so the sidebar
// fills to the viewport bottom.
const NAV_WRAPPER_CLASS =
  'border-border shrink-0 overflow-y-auto text-md lg:sticky lg:top-[6.5rem] lg:h-[calc(100dvh-6.5rem)] lg:w-60 lg:self-start lg:border-r lg:py-8 lg:pr-4'

/**
 * Resolve the active tab for a set of groups: the tab owning the current
 * article, else the first tab with any groups, else the first declared tab.
 * Returned alongside that tab's groups so the caller renders only them and
 * announces the tab id on the wrapper.
 */
const resolveActiveZone = (
  groups: readonly NavGroup[],
  tabs: CollectionNavTabs
): { readonly zone: string; readonly groups: readonly NavGroup[] } => {
  const groupsFor = (tab: DocsNavTab): readonly NavGroup[] =>
    groupsForTab(groups, tab, tabs, tab === tabs[0])
  const active =
    tabs.find((tab) => groupsFor(tab).some(groupIsActive)) ??
    tabs.find((tab) => groupsFor(tab).length > 0) ??
    tabs[0]
  // `tabs` is non-empty (schema `minItems(1)` + the `hasDocsTabs` guard at the
  // call site), but `noUncheckedIndexedAccess` still widens `tabs[0]`.
  if (active === undefined) return { zone: '', groups }
  return { zone: active.id, groups: groupsFor(active) }
}

/**
 * The collection navigation, folded into a drawer below `lg`.
 *
 * Below `lg` a docs page has no column to spare, and before the drawer existed
 * the navigation simply left the layout — a reader on a phone could reach the
 * page they landed on and its two neighbours, and nothing else. The docs nav has
 * no schema, so the fold is unconditional: the same frame the `sidebar`
 * component's `drawer` key draws, with its breakpoint fixed at `lg`, where the
 * docs column already returned. The `nav` itself moves into the dialog, so its
 * landmark and its name are the same at every width.
 *
 * The frame's root is `display: contents`, so at `lg` and above the `nav` is a
 * flex item of the docs row exactly as it was before — sticky, full height.
 */
export function DocsSidebarNav({ nav, menuLabel }: DocsSidebarNavProps): Readonly<ReactElement> {
  return (
    <div
      {...{ [SIDEBAR_DRAWER_ROOT_ATTRIBUTE]: '' }}
      className="contents"
    >
      <SidebarDrawerFrame
        below="lg"
        label={menuLabel}
      >
        {renderDocsNav(nav)}
      </SidebarDrawerFrame>
    </div>
  )
}

function renderDocsNav(nav: CollectionNavData): Readonly<ReactElement> {
  const groups = bucketByGroup(nav.sidebar)
  const collapsed = nav.collapsed === true
  // Zone filtering applies only to a collection that DECLARES its tabs
  // (`contentDir.nav.tabs`). A collection with no declared IA falls back to the
  // flat stack (all groups, no zone attribute) — tabs are opt-in.
  const { tabs } = nav
  const zoned = !collapsed && hasDocsTabs(tabs)
  if (!zoned) {
    return (
      <nav
        data-component="docs-sidebar-nav"
        aria-label="Documentation"
        className={NAV_WRAPPER_CLASS}
      >
        {groups.map((group, index) => renderGroup(group, index, collapsed))}
      </nav>
    )
  }
  // Render ONLY the active tab's groups (the app owns its own tab strip);
  // announce the active tab id so the app's tab-strip markup can mark the
  // matching link `aria-current="page"`.
  const { zone, groups: zoneGroups } = resolveActiveZone(groups, tabs)
  return (
    <nav
      data-component="docs-sidebar-nav"
      data-docs-active-zone={zone}
      aria-label="Documentation"
      className={NAV_WRAPPER_CLASS}
    >
      {zoneGroups.map((group, index) => renderGroup(group, index, false))}
    </nav>
  )
}
