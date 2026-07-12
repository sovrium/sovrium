/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { fetchGroupItems, IDLE_GROUP_STATE, type GroupLoadState } from './admin-sidebar-groups-data'
import { FamilyGlyph } from './admin-sidebar-icon'
import type { DataNavItem } from './admin-sidebar-data-nav'

function DisclosureChevron({ expanded }: { readonly expanded: boolean }): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-foreground-subtle shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function GroupStatusLine({ state }: { readonly state: GroupLoadState }): ReactElement | null {
  if (state.phase === 'loading') {
    return (
      <li
        aria-busy="true"
        className="text-foreground-subtle px-2 py-1 pl-8 text-xs"
      >
        Chargement…
      </li>
    )
  }
  if (state.phase === 'error') {
    return (
      <li
        role="status"
        className="text-foreground-subtle px-2 py-1 pl-8 text-xs"
      >
        Impossible de charger la liste.
      </li>
    )
  }
  if (state.phase === 'loaded' && state.items.length === 0) {
    return <li className="text-foreground-subtle px-2 py-1 pl-8 text-xs">Aucun élément.</li>
  }
  return null
}

function GroupChildRow({
  itemKey,
  name,
  active,
}: {
  readonly itemKey: string
  readonly name: string
  readonly active: boolean
}): ReactElement {
  return (
    <li>
      <a
        href={`/_admin/${itemKey}/${name}`}
        aria-current={active ? 'page' : undefined}
        data-testid={`data-nav-${itemKey}-${name}`}
        className={`block truncate rounded-md py-1 pr-2 pl-8 text-sm ${
          active
            ? 'bg-warmth-subtle text-warmth-fg font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        {name}
      </a>
    </li>
  )
}

function GroupToggleHeader({
  item,
  parentActive,
  expanded,
  listId,
  onToggle,
}: {
  readonly item: DataNavItem
  readonly parentActive: boolean
  readonly expanded: boolean
  readonly listId: string
  readonly onToggle: () => void
}): ReactElement {
  return (
    <div
      className={`flex items-center gap-1 rounded-md pr-1 ${
        parentActive ? 'bg-warmth-subtle' : 'hover:bg-background-subtle'
      }`}
    >
      <button
        type="button"
        aria-label={expanded ? `Réduire ${item.label}` : `Développer ${item.label}`}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={onToggle}
        className="text-foreground-subtle hover:text-foreground focus-visible:ring-primary shrink-0 rounded p-1 outline-none focus-visible:ring-2"
      >
        <DisclosureChevron expanded={expanded} />
      </button>
      <a
        href={item.href}
        aria-current={parentActive ? 'page' : undefined}
        data-testid={`data-nav-${item.key}`}
        className={`flex flex-1 items-center gap-2 truncate py-1.5 text-sm ${
          parentActive ? 'text-warmth-fg font-medium' : 'text-foreground-muted'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </div>
  )
}

function GroupChildList({
  itemKey,
  listId,
  state,
  activePath,
}: {
  readonly itemKey: string
  readonly listId: string
  readonly state: GroupLoadState
  readonly activePath: string
}): ReactElement {
  return (
    <ul
      id={listId}
      className="mt-0.5 flex flex-col gap-0.5"
    >
      {state.items.map((child) => (
        <GroupChildRow
          key={child.name}
          itemKey={itemKey}
          name={child.name}
          active={activePath === `/${itemKey}/${child.name}`}
        />
      ))}
      <GroupStatusLine state={state} />
    </ul>
  )
}

function useDataNavGroupDisclosure(itemKey: string, parentActive: boolean) {
  const [expanded, setExpanded] = useState(parentActive)
  const [state, setState] = useState<GroupLoadState>(IDLE_GROUP_STATE)

  useEffect(() => {
    if (parentActive) setExpanded(true)
  }, [parentActive])

  useEffect(() => {
    if (!expanded || state.phase !== 'idle') return
    setState({ phase: 'loading', items: [] })
    void fetchGroupItems(itemKey).then(setState)
  }, [expanded, state.phase, itemKey])

  const onToggle = useCallback(() => setExpanded((open) => !open), [])
  return { expanded, state, onToggle }
}

export function DataNavGroup({
  item,
  parentActive,
  activePath,
}: {
  readonly item: DataNavItem
  readonly parentActive: boolean
  readonly activePath: string
}): ReactElement {
  const { expanded, state, onToggle } = useDataNavGroupDisclosure(item.key, parentActive)
  const listId = `data-nav-group-${item.key}`
  return (
    <li>
      <GroupToggleHeader
        item={item}
        parentActive={parentActive}
        expanded={expanded}
        listId={listId}
        onToggle={onToggle}
      />
      {expanded && (
        <GroupChildList
          itemKey={item.key}
          listId={listId}
          state={state}
          activePath={activePath}
        />
      )}
    </li>
  )
}
