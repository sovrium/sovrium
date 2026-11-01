/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveLucideIcon } from '@/presentation/render/elements/lucide-resolver'
import { renderPageSearch } from '@/presentation/render/elements/search-input-renderers'
import {
  SIDEBAR_DRAWER_ROOT_ATTRIBUTE,
  SidebarDrawerFrame,
} from '@/presentation/render/registry/sidebar-drawer'
import { DOCS_NAV_FRAME_CLASSES } from './docs-frame'
import {
  bucketByGroup,
  type DocsNavTab,
  getTabLabel,
  groupsForTab,
  hasDocsTabs,
  type NavGroup,
  tabLandingHref,
} from './docs-sidebar-tabs'
import type { PartClassMap } from '@/domain/models/app/design/component-parts'
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
 * article's tab, and the wrapper announces the active tab id via
 * `data-docs-active-zone`. With `tabsPlacement: header` (the default) the tab
 * strip belongs to the app's header, which matches on that id; with
 * `tabsPlacement: sidebar` the sidebar draws the tabs itself as a zone list at
 * its top, the active zone expanded with its groups. `search: sidebar` puts the
 * page search at the very top, in the sidebar header. A collection declaring no
 * tabs falls back to the flat expanded stack. The wrapper is always
 * `<nav data-component="docs-sidebar-nav" aria-label="Documentation">` so spec
 * selectors stay stable.
 */
interface DocsSidebarNavProps {
  readonly nav: CollectionNavData
  /** Accessible name of the menu button that opens the navigation below `lg`. */
  readonly menuLabel: string
  /** Accessible name of the drawer's close button, in the page language. */
  readonly closeLabel: string
  /** Placeholder of the docs search field (`nav.search: sidebar`), in the page language. */
  readonly searchLabel: string
  /** `markdown.classes` by part: `sidebar`, `navGroupLabel`, `navLink` (current state folded in). */
  readonly parts?: PartClassMap | undefined
}

type Parts = DocsSidebarNavProps['parts']

const ENTRY_BASE_CLASS =
  'block rounded-md px-3 py-1.5 text-md transition-colors duration-150 border-l-2'
const ENTRY_ACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-border-strong bg-popover font-medium text-foreground`
const ENTRY_INACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-transparent text-muted-foreground hover:bg-popover/60 hover:text-foreground`

const renderEntry = (entry: CollectionNavEntry, parts: Parts): Readonly<ReactElement> => (
  <li
    key={entry.slug}
    data-current={entry.isCurrent ? 'true' : undefined}
  >
    <a
      href={entry.href}
      aria-current={entry.isCurrent ? 'page' : undefined}
      className={cn(
        entry.isCurrent ? ENTRY_ACTIVE_CLASS : ENTRY_INACTIVE_CLASS,
        parts?.['navLink']
      )}
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
/** An expanded section: a top rule, suppressed on the first one. */
const SECTION_GROUP_CLASS = 'border-border mb-6 border-t pt-6 first:border-t-0 first:pt-0'

const GROUP_LABEL_CLASS =
  'mb-2 px-3 text-sm font-semibold tracking-wide text-foreground-subtle uppercase'

const renderGroup = (
  group: NavGroup,
  index: number,
  collapsed: boolean,
  parts: Parts
): Readonly<ReactElement> => {
  const entries = group.entries.map((entry) => renderEntry(entry, parts))
  const labelClass = cn(GROUP_LABEL_CLASS, parts?.['navGroupLabel'])
  if (group.name === undefined) {
    return (
      <ul
        key={`flat-${index}`}
        className="space-y-0.5"
      >
        {entries}
      </ul>
    )
  }

  const list = <ul className="space-y-0.5">{entries}</ul>

  // Collapsed mode: native <details>/<summary> — zero JS, only the active
  // group's <details> is `open` so a long docs tree stays scannable.
  if (collapsed) {
    return (
      <details
        key={group.name}
        data-nav-group={group.name}
        className={cn('mb-3 [&>summary]:list-none', parts?.['navGroup'])}
        open={groupIsActive(group) ? true : undefined}
      >
        <summary
          className={`${labelClass} flex cursor-pointer items-center justify-between [&::-webkit-details-marker]:hidden`}
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
      className={cn(SECTION_GROUP_CLASS, parts?.['navGroup'])}
    >
      <p className={`${labelClass} flex items-center gap-2`}>
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
const NAV_WRAPPER_CLASS = `border-border shrink-0 overflow-y-auto text-md ${DOCS_NAV_FRAME_CLASSES} lg:border-r lg:py-8 lg:pr-4`

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
 * Below `lg` the frame's root is the bar across the column that holds the menu
 * button — named `container`, as the app shell's own fold bar is. At `lg` and
 * above it is `display: contents`, so the `nav` is a flex item of the docs row
 * exactly as it was before — sticky, full height.
 */
export function DocsSidebarNav({
  nav,
  menuLabel,
  closeLabel,
  searchLabel,
  parts,
}: DocsSidebarNavProps): Readonly<ReactElement> {
  return (
    <div
      {...{ [SIDEBAR_DRAWER_ROOT_ATTRIBUTE]: '' }}
      data-component-type="container"
      className="flex flex-col lg:contents"
    >
      <SidebarDrawerFrame
        below="lg"
        label={menuLabel}
        closeLabel={closeLabel}
        triggerClassName={parts?.['menuButton']}
      >
        {renderDocsNav(nav, parts, searchLabel)}
      </SidebarDrawerFrame>
    </div>
  )
}

/**
 * The docs search field heading the sidebar (`nav.search: sidebar`): the page
 * search island, answering per request like `index: session` because the
 * prebuilt public index holds no collection article, and the per-request
 * answer honours each article's front-matter access. Undefined when not asked.
 */
const renderSidebarSearch = (
  nav: CollectionNavData,
  searchLabel: string
): Readonly<ReactElement> | undefined => {
  if (nav.search !== 'sidebar') return undefined
  return (
    <div
      data-slot="sidebar-header"
      className="mb-6"
    >
      {renderPageSearch({ props: {}, placeholder: searchLabel, sessionIndex: true })}
    </div>
  )
}

const ZONE_BUTTON_BASE_CLASS =
  'flex w-full items-center rounded-md px-3 py-1.5 text-md font-medium transition-colors duration-150'
const ZONE_BUTTON_ACTIVE_CLASS = `${ZONE_BUTTON_BASE_CLASS} bg-popover text-foreground`
const ZONE_BUTTON_INACTIVE_CLASS = `${ZONE_BUTTON_BASE_CLASS} text-muted-foreground hover:bg-popover/60 hover:text-foreground`

/**
 * The zone list `tabsPlacement: sidebar` draws: every declared tab, in order,
 * as a sidebar menu item linking to its landing. The active zone's link is
 * `aria-current="true"` (not `"page"`: the article being read already carries
 * that mark in the same navigation) and `data-active`, and only the active
 * zone holds its groups, so they fold into the phone drawer with the rest.
 */
const renderZoneList = (
  nav: CollectionNavData,
  tabs: CollectionNavTabs,
  active: { readonly zone: string; readonly groups: readonly NavGroup[] },
  parts: Parts
): Readonly<ReactElement> => (
  <ul
    data-docs-zones=""
    data-slot="sidebar-menu"
    className="space-y-1"
  >
    {tabs.map((tab) => {
      const isActive = tab.id === active.zone
      return (
        <li
          key={tab.id}
          data-docs-zone={tab.id}
          data-slot="sidebar-menu-item"
        >
          <a
            href={tabLandingHref(tab, nav.sidebar, tabs)}
            data-slot="sidebar-menu-button"
            data-active={isActive ? '' : undefined}
            aria-current={isActive ? 'true' : undefined}
            className={isActive ? ZONE_BUTTON_ACTIVE_CLASS : ZONE_BUTTON_INACTIVE_CLASS}
          >
            {getTabLabel(tab)}
          </a>
          {isActive && (
            <div className="mt-3 mb-4 pl-2">
              {active.groups.map((group, index) =>
                renderGroup(group, index, nav.collapsed === true, parts)
              )}
            </div>
          )}
        </li>
      )
    })}
  </ul>
)

function renderDocsNav(
  nav: CollectionNavData,
  parts: Parts,
  searchLabel: string
): Readonly<ReactElement> {
  const navClass = cn(NAV_WRAPPER_CLASS, parts?.['sidebar'])
  const groups = bucketByGroup(nav.sidebar)
  const collapsed = nav.collapsed === true
  const search = renderSidebarSearch(nav, searchLabel)
  // Zone filtering applies only to a collection that DECLARES its tabs
  // (`contentDir.nav.tabs`). A collection with no declared IA falls back to the
  // flat stack (all groups, no zone attribute) — tabs are opt-in. `collapsed`
  // composes with either branch: it only folds the groups that are rendered.
  const { tabs } = nav
  if (!hasDocsTabs(tabs)) {
    return (
      <nav
        data-component="docs-sidebar-nav"
        data-component-type="sidebar"
        aria-label="Documentation"
        className={navClass}
      >
        {search}
        {groups.map((group, index) => renderGroup(group, index, collapsed, parts))}
      </nav>
    )
  }
  // Render ONLY the active tab's groups and announce the active tab id, which
  // the app's own tab strip reads under `tabsPlacement: header`; under
  // `sidebar` the zone list draws the tabs here, the active one expanded.
  const active = resolveActiveZone(groups, tabs)
  return (
    <nav
      data-component="docs-sidebar-nav"
      data-component-type="sidebar"
      data-docs-active-zone={active.zone}
      aria-label="Documentation"
      className={navClass}
    >
      {search}
      {nav.tabsPlacement === 'sidebar'
        ? renderZoneList(nav, tabs, active, parts)
        : active.groups.map((group, index) => renderGroup(group, index, collapsed, parts))}
    </nav>
  )
}
