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

import { useMemo, type ReactElement, type ReactNode } from 'react'
import type { TreeNode } from './tree-model'

const CHEVRON_OPEN = 'M4 6l4 4 4-4'
const CHEVRON_CLOSED = 'M6 4l4 4-4 4'

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
      className="text-muted-foreground flex size-4 shrink-0 items-center justify-center"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {expanded !== undefined && (
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d={expanded ? CHEVRON_OPEN : CHEVRON_CLOSED} />
        </svg>
      )}
    </span>
  )
}

/** The node's own row: chevron, label, count, indented 20 px a level. */
function TreeRow({
  node,
  expanded,
  onToggle,
}: {
  readonly node: TreeNode
  readonly expanded: boolean | undefined
  readonly onToggle: () => void
}): ReactElement {
  const indent = useMemo(() => ({ paddingLeft: (node.level - 1) * 20 }), [node.level])
  return (
    <div
      className="hover:bg-muted flex h-8 cursor-pointer items-center gap-1 rounded-sm pr-2 text-sm"
      style={indent}
    >
      <Chevron
        expanded={expanded}
        onToggle={onToggle}
      />
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      {node.count !== undefined && (
        <span className="text-muted-foreground font-mono text-xs">{node.count}</span>
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
  return (
    <li
      role="treeitem"
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
      className="focus-visible:ring-ring aria-selected:[&>div]:bg-muted rounded-sm outline-none focus-visible:ring-2"
    >
      <TreeRow
        node={node}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded === true && (
        <ul
          role="group"
          className="border-border ml-2 border-l"
        >
          {children}
        </ul>
      )}
    </li>
  )
}
