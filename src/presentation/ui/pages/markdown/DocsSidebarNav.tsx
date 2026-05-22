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
  readonly entries: readonly CollectionNavEntry[]
}

const bucketByGroup = (entries: readonly CollectionNavEntry[]): readonly NavGroup[] => {
  const orderedNames = entries.reduce<readonly string[]>((acc, entry) => {
    const name = entry.group
    if (name === undefined) return acc
    if (acc.includes(name)) return acc
    return [...acc, name]
  }, [])
  const grouped = orderedNames.map((name) => ({
    name,
    entries: entries.filter((entry) => entry.group === name),
  }))
  const ungrouped = entries.filter((entry) => entry.group === undefined)
  if (ungrouped.length === 0) return grouped
  if (grouped.length === 0) return [{ name: undefined, entries: ungrouped }]
  return [...grouped, { name: undefined, entries: ungrouped }]
}

const renderEntry = (entry: CollectionNavEntry): Readonly<ReactElement> => (
  <li
    key={entry.slug}
    data-current={entry.isCurrent ? 'true' : undefined}
  >
    <a
      href={entry.href}
      aria-current={entry.isCurrent ? 'page' : undefined}
    >
      {entry.label}
    </a>
  </li>
)

const renderGroup = (group: NavGroup, index: number): Readonly<ReactElement> => {
  if (group.name === undefined) {
    return (
      <ul
        key={`flat-${index}`}
        className="space-y-1"
      >
        {group.entries.map(renderEntry)}
      </ul>
    )
  }
  return (
    <section
      key={group.name}
      data-nav-group={group.name}
      className="mb-4"
    >
      <h3 className="text-text mb-2 text-sm font-semibold">{group.name}</h3>
      <ul className="space-y-1">{group.entries.map(renderEntry)}</ul>
    </section>
  )
}

export function DocsSidebarNav({ nav }: DocsSidebarNavProps): Readonly<ReactElement> {
  const groups = bucketByGroup(nav.sidebar)
  return (
    <nav
      data-component="docs-sidebar-nav"
      aria-label="Documentation"
      className="w-64 shrink-0 px-4 py-8 text-sm"
    >
      {groups.map(renderGroup)}
    </nav>
  )
}
