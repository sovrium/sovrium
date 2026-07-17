/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveLucideIcon } from '@/presentation/utils/lucide-resolver'
import { type TabId, TAB_ORDER, sectionHasTab, tabOfSection } from './DocsSidebarTabs'
import type {
  CollectionNavData,
  CollectionNavEntry,
} from '@/presentation/rendering/content-dir-lister'

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

interface DocsSidebarNavProps {
  readonly nav: CollectionNavData
}

interface NavGroup {
  readonly name: string | undefined
  readonly label: string | undefined
  readonly icon: string | undefined
  readonly entries: readonly CollectionNavEntry[]
}

const bucketByGroup = (entries: readonly CollectionNavEntry[]): readonly NavGroup[] => {
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
  if (grouped.length === 0)
    return [{ name: undefined, label: undefined, icon: undefined, entries: ungrouped }]
  return [...grouped, { name: undefined, label: undefined, icon: undefined, entries: ungrouped }]
}

const ENTRY_BASE_CLASS =
  'block rounded-md px-3 py-1.5 text-sm transition-colors duration-150 border-l-2'
const ENTRY_ACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-warmth-border bg-background-overlay font-medium text-foreground`
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

const groupIsActive = (group: NavGroup): boolean => group.entries.some((entry) => entry.isCurrent)

const GROUP_LABEL_CLASS =
  'mb-2 px-3 text-xs font-semibold tracking-wide text-foreground-subtle uppercase'

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

const NAV_WRAPPER_CLASS =
  'border-border sticky top-[6.5rem] hidden h-[calc(100dvh-6.5rem)] w-60 shrink-0 self-start overflow-y-auto border-r py-8 pr-4 text-sm lg:block'

const resolveActiveZone = (
  groups: readonly NavGroup[]
): { readonly zone: TabId; readonly groups: readonly NavGroup[] } => {
  const groupsFor = (zone: TabId): readonly NavGroup[] =>
    groups.filter((group) => tabOfSection(group.name) === zone)
  const zone =
    TAB_ORDER.find((z) => groupsFor(z).some(groupIsActive)) ??
    TAB_ORDER.find((z) => groupsFor(z).length > 0) ??
    'runtime'
  return { zone, groups: groupsFor(zone) }
}

export function DocsSidebarNav({ nav }: DocsSidebarNavProps): Readonly<ReactElement> {
  const groups = bucketByGroup(nav.sidebar)
  const collapsed = nav.collapsed === true
  const zoned = !collapsed && groups.some((group) => sectionHasTab(group.name))
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
  const { zone, groups: zoneGroups } = resolveActiveZone(groups)
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
