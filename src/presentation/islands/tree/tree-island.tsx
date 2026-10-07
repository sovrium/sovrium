/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `tree` island — the records of one table nested by a relationship to itself.
 *
 * The rows come from the records API (through the bound view when there is
 * one), so the reader sees exactly the rows that API answers her. The drawing
 * follows the WAI tree pattern: `tree` / `treeitem` / `group`, `aria-level`,
 * `aria-expanded` on a branch, ONE node in the tab order (roving tabindex), the
 * arrows to move and open, Home / End, and type-ahead on the first letter.
 *
 * The filter box keeps a match's ancestors on screen, so a match is never drawn
 * out of place.
 */

import { useRef, type ReactElement } from 'react'
import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'
import { TreeItem } from './tree-item'
import { useTreeKeyboard } from './use-tree-keyboard'
import { useTreeState } from './use-tree-state'
import type { TreeConfig } from './tree-model'
import type { TreeSelect } from './tree-select'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'

interface TreeIslandProps extends TreeConfig {
  readonly dataSource?: RecordsDataSource
  readonly expanded?: number
  readonly search?: boolean
  readonly onSelect?: TreeSelect
  readonly publishes?: SharedFilterPublisherConfig
  readonly emptyMessage?: string
  readonly label: string
}

type TreeState = ReturnType<typeof useTreeState>

/** The `tree` list itself, its nodes drawn from the open branches down. */
function TreeList({
  state,
  label,
}: {
  readonly state: TreeState
  readonly label: string
}): ReactElement {
  const treeRef = useRef<HTMLUListElement | null>(null)
  const { forest, kept, openIds, selected, tabbable } = state
  const onKeyDown = useTreeKeyboard({
    forest,
    visible: state.visible,
    open: openIds,
    current: tabbable,
    toggle: state.toggle,
    select: state.select,
    focus: (id) => {
      state.setFocused(id)
      treeRef.current?.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(id)}"]`)?.focus()
    },
  })
  const isKept = (id: string): boolean => kept === undefined || kept.has(id)
  const renderNode = (id: string): ReactElement | null => {
    const node = forest.nodes.get(id)
    if (node === undefined) return null
    const expanded = node.childIds.length > 0 ? kept !== undefined || openIds.has(id) : undefined
    return (
      <TreeItem
        key={id}
        node={node}
        expanded={expanded}
        selected={selected === id}
        tabbable={tabbable === id}
        onFocus={() => state.setFocused(id)}
        onToggle={() => state.toggle(id, expanded !== true)}
        onSelect={() => state.select(id)}
      >
        {expanded === true && node.childIds.filter(isKept).map(renderNode)}
      </TreeItem>
    )
  }
  return (
    <ul
      ref={treeRef}
      role="tree"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-col"
    >
      {forest.rootIds.filter(isKept).map(renderNode)}
    </ul>
  )
}

/** The filter box above the tree. */
function TreeFilter(props: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
}): ReactElement {
  return (
    <input
      type="search"
      aria-label={`Filter ${props.label.toLocaleLowerCase()}`}
      placeholder="Filter"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      className="border-border h-9 rounded-md border px-3 text-sm"
    />
  )
}

const QUIET = 'text-muted-foreground text-sm'

const treePhase = (pending: boolean, roots: number): 'loading' | 'empty' | 'ready' =>
  pending ? 'loading' : roots === 0 ? 'empty' : 'ready'

export default function TreeIsland(props: TreeIslandProps): ReactElement {
  const query = useRecordsQuery('tree', props.dataSource)
  const state = useTreeState({
    ...props,
    rows: query.data?.records,
    table: props.dataSource?.table,
  })
  if (query.isError) {
    return <p role="alert">{`${props.label} could not be loaded. Refresh to try again.`}</p>
  }
  const phase = treePhase(query.isPending, state.forest.rootIds.length)
  return (
    <div className="flex flex-col gap-2">
      {props.search !== false && (
        <TreeFilter
          label={props.label}
          value={state.filter}
          onChange={state.setFilter}
        />
      )}
      {phase === 'loading' && (
        <p
          aria-busy="true"
          className={QUIET}
        >
          Loading…
        </p>
      )}
      {phase === 'empty' && <p className={QUIET}>{props.emptyMessage ?? 'Nothing here yet.'}</p>}
      {phase === 'ready' && (
        <TreeList
          state={state}
          label={props.label}
        />
      )}
    </div>
  )
}
