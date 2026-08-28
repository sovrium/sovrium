/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Notion-style expandable sidebar disclosures for the Application section
 *.
 *
 * Each Application destination (Records / Submissions / Files / Conversations)
 * is a collapsible toggle: clicking the chevron expands the group and LAZY-LOADS
 * its object list on first expand (tables / forms / buckets / agents — see
 * {@link fetchGroupItems}); clicking the label still SPA-navigates to the
 * destination's own page. Each loaded object is a real `<a href="/_admin/{key}/
 * {name}">` link, so the shell's SPA-nav island intercepts it for a content-only
 * swap — selecting an object opens its runtime-data surface WITHOUT the old
 * in-page object picker. Loading / empty / error states are all rendered.
 *
 * Keyboard a11y: the toggle is a `<button aria-expanded>` (Enter/Space toggle);
 * the expanded list is real links in tab order; the active object carries
 * `aria-current="page"`.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { fetchGroupItems, IDLE_GROUP_STATE, type GroupLoadState } from './admin-sidebar-groups-data'
import { FamilyGlyph } from './admin-sidebar-icon'
import type { DataNavItem } from './admin-sidebar-data-nav'

/** A chevron that rotates with the disclosure's expanded state (decorative). */
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

/** Resolve a per-phase status line shown beneath an expanded group. */
function GroupStatusLine({ state }: { readonly state: GroupLoadState }): ReactElement | null {
  if (state.phase === 'loading') {
    return (
      <li
        aria-busy="true"
        className="text-foreground-subtle px-2 py-1 pl-8 text-xs"
      >
        Loading…
      </li>
    )
  }
  if (state.phase === 'error') {
    return (
      <li
        role="status"
        className="text-foreground-subtle px-2 py-1 pl-8 text-xs"
      >
        Couldn’t load the list.
      </li>
    )
  }
  if (state.phase === 'loaded' && state.items.length === 0) {
    return <li className="text-foreground-subtle px-2 py-1 pl-8 text-xs">No items.</li>
  }
  // eslint-disable-next-line unicorn/no-null -- React conditional needs null, not undefined
  return null
}

/** One expanded child object row: a link to `/_admin/{key}/{name}`. */
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
            ? 'text-foreground-muted bg-background-subtle font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        {name}
      </a>
    </li>
  )
}

/** The disclosure's header row: the chevron toggle button + the destination label link. */
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
        parentActive ? 'bg-background-subtle' : 'hover:bg-background-subtle'
      }`}
    >
      <button
        type="button"
        aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
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
          parentActive ? 'text-foreground-muted font-medium' : 'text-foreground-muted'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </div>
  )
}

/** The expanded child list: one row per loaded object + the per-phase status line. */
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

/**
 * Open the group automatically when its section is the active one, and lazy-load
 * its child list on first expand. The disclosure is default-OPEN when
 * `parentActive` so an operator who lands on (or SPA-navigates into) any
 * Application destination sees its object list without a second
 * click; the re-open effect is one-directional (only opens) so a manual collapse
 * on the active section is respected until the operator navigates away and back.
 */
function useDataNavGroupDisclosure(itemKey: string, parentActive: boolean) {
  const [expanded, setExpanded] = useState(parentActive)
  const [state, setState] = useState<GroupLoadState>(IDLE_GROUP_STATE)

  useEffect(() => {
    if (parentActive) setExpanded(true)
  }, [parentActive])

  // Lazy-load on FIRST expand only (idle → loading → loaded/error).
  useEffect(() => {
    if (!expanded || state.phase !== 'idle') return
    setState({ phase: 'loading', items: [] })
    void fetchGroupItems(itemKey).then(setState)
  }, [expanded, state.phase, itemKey])

  const onToggle = useCallback(() => setExpanded((open) => !open), [])
  return { expanded, state, onToggle }
}

/**
 * One Application-section disclosure: a toggle (chevron + glyph + label link)
 * over a lazy-loaded child list. The label is a real link to the destination
 * page; the chevron button toggles expansion and triggers the first fetch.
 */
export function DataNavGroup({
  item,
  parentActive,
  activePath,
}: {
  readonly item: DataNavItem
  /** True when the active path is this destination's page or an object under it. */
  readonly parentActive: boolean
  /** The `/_admin`-stripped active path (drives the active child highlight). */
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
