/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type {
  CollectionNavData,
  CollectionNavEntry,
} from '@/presentation/rendering/content-dir-lister'

interface DocsSidebarNavProps {
  readonly nav: CollectionNavData
}

interface NavGroup {
  readonly name: string | undefined
  readonly label: string | undefined
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
      entries: groupEntries,
    }
  })
  const ungrouped = entries.filter((entry) => entry.group === undefined)
  if (ungrouped.length === 0) return grouped
  if (grouped.length === 0) return [{ name: undefined, label: undefined, entries: ungrouped }]
  return [...grouped, { name: undefined, label: undefined, entries: ungrouped }]
}

const ENTRY_BASE_CLASS =
  'block rounded-md px-3 py-1.5 text-sm transition-colors duration-150 border-l-2'
const ENTRY_ACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-warmth-border bg-neutral-900 font-medium text-neutral-50`
const ENTRY_INACTIVE_CLASS = `${ENTRY_BASE_CLASS} border-transparent text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-100`

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

const GROUP_LABEL_CLASS = 'mb-2 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase'

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
          {group.label}
          <span
            aria-hidden="true"
            className="ml-2 text-neutral-600 transition-transform duration-150"
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
      className="mb-6"
    >
      <p className={GROUP_LABEL_CLASS}>{group.label}</p>
      {list}
    </section>
  )
}

export function DocsSidebarNav({ nav }: DocsSidebarNavProps): Readonly<ReactElement> {
  const groups = bucketByGroup(nav.sidebar)
  const collapsed = nav.collapsed === true
  return (
    <nav
      data-component="docs-sidebar-nav"
      aria-label="Documentation"
      className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-60 shrink-0 self-start overflow-y-auto border-r border-neutral-800 py-8 pr-4 text-sm lg:block"
    >
      {groups.map((group, index) => renderGroup(group, index, collapsed))}
    </nav>
  )
}
