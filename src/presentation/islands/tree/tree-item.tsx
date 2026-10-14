/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One node of the tree: its chevron, its label and its count on one row, and
 * its open children in a `group` beneath. Indent is 20 px a level, with a
 * hairline guide down the open branch.
 */

import { type ReactElement, type ReactNode } from 'react'
import {
  computeTreeChevronClasses,
  computeTreeCountClasses,
  computeTreeItemButtonClasses,
  computeTreeItemClasses,
  computeTreeSubClasses,
} from '@/presentation/design/tree-default-classes'
import type { TreeNode } from './tree-model'

/** `ChevronRight`, as lucide draws it; the open turn is a class, not a second path. */
const CHEVRON_RIGHT = 'm9 18 6-6-6-6'
const ITEM = computeTreeItemClasses()
const ROW = computeTreeItemButtonClasses()
const SUB = computeTreeSubClasses()
const COUNT = computeTreeCountClasses()

/** The disclosure chevron of a branch; a leaf keeps the space empty. */
function Chevron({
  expanded,
  onToggle,
}: {
  readonly expanded: boolean | undefined
  readonly onToggle: () => void
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {expanded !== undefined && (
        <svg
          viewBox="0 0 24 24"
          className={computeTreeChevronClasses(expanded)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d={CHEVRON_RIGHT} />
        </svg>
      )}
    </span>
  )
}

/** The node's own row: chevron, label, count. Nesting indents it, not padding. */
function TreeRow({
  node,
  expanded,
  selected,
  onToggle,
}: {
  readonly node: TreeNode
  readonly expanded: boolean | undefined
  readonly selected: boolean
  readonly onToggle: () => void
}): ReactElement {
  return (
    <div
      data-slot="tree-item-button"
      data-active={selected}
      className={ROW}
    >
      <Chevron
        expanded={expanded}
        onToggle={onToggle}
      />
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      {node.count !== undefined && (
        <span
          data-slot="tree-item-count"
          className={COUNT}
        >
          {node.count}
        </span>
      )}
    </div>
  )
}

/**
 * A branch: a collapsible holding its row and, while open, its children in a
 * ruled sub-menu. `data-open` / `data-closed` are Base UI's own state marks.
 */
function Branch({
  open,
  row,
  children,
}: {
  readonly open: boolean
  readonly row: ReactElement
  readonly children: ReactNode
}): ReactElement {
  return (
    <div
      data-slot="collapsible"
      {...(open ? { 'data-open': '' } : { 'data-closed': '' })}
    >
      {row}
      {open && (
        <div data-slot="collapsible-content">
          <ul
            role="group"
            data-slot="tree-sub"
            className={SUB}
          >
            {children}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TreeItem({
  node,
  expanded,
  selected,
  tabbable,
  onFocus,
  onToggle,
  onSelect,
  children,
}: {
  readonly node: TreeNode
  readonly expanded: boolean | undefined
  readonly selected: boolean
  readonly tabbable: boolean
  readonly onFocus: () => void
  readonly onToggle: () => void
  readonly onSelect: () => void
  readonly children: ReactNode
}): ReactElement {
  const row = (
    <TreeRow
      node={node}
      expanded={expanded}
      selected={selected}
      onToggle={onToggle}
    />
  )
  return (
    <li
      role="treeitem"
      data-slot="tree-item"
      data-tree-node={node.id}
      aria-level={node.level}
      aria-expanded={expanded}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      className={ITEM}
    >
      {expanded === undefined ? (
        row
      ) : (
        <Branch
          open={expanded}
          row={row}
        >
          {children}
        </Branch>
      )}
    </li>
  )
}
