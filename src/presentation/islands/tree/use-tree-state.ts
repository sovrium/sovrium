/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The tree's state: the forest built from the rows, which branches are open,
 * the filter, the node in the tab order and the selected one — and the two
 * actions on them, toggle and select.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSharedFilterPublisher } from '../hooks/use-shared-filter-publisher'
import { buildForest, initiallyOpen, keptByFilter, visibleIds, type TreeConfig } from './tree-model'
import { selectTreeNode, type TreeSelect } from './tree-select'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'
import type { TableRecord } from '../runtime/types'

export interface TreeStateInput extends TreeConfig {
  readonly rows: readonly TableRecord[] | undefined
  readonly expanded?: number
  readonly onSelect?: TreeSelect
  readonly publishes?: SharedFilterPublisherConfig
  readonly table?: string
}

export function useTreeState(input: TreeStateInput) {
  const { rows, parentField, labelField, countField, iconField, sortBy } = input
  const forest = useMemo(
    () => buildForest(rows ?? [], { parentField, labelField, countField, iconField, sortBy }),
    [rows, parentField, labelField, countField, iconField, sortBy]
  )
  const [open, setOpen] = useState<ReadonlySet<string> | undefined>(undefined)
  const depth = input.expanded ?? 1
  const openIds = useMemo(() => open ?? initiallyOpen(forest, depth), [open, forest, depth])
  const [filter, setFilter] = useState('')
  const kept = useMemo(() => keptByFilter(forest, filter), [forest, filter])
  const visible = useMemo(() => visibleIds(forest, openIds, kept), [forest, openIds, kept])
  const [focused, setFocused] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const publish = useSharedFilterPublisher(input.publishes)
  const { onSelect, table } = input

  const toggle = useCallback(
    (id: string, next: boolean) =>
      setOpen(() => {
        const set = new Set(openIds)
        if (next) set.add(id)
        else set.delete(id)
        return set
      }),
    [openIds]
  )
  const select = useCallback(
    (id: string) => {
      const node = forest.nodes.get(id)
      if (node === undefined) return
      setSelected(id)
      publish(id)
      selectTreeNode(onSelect, node.record, table)
    },
    [forest, publish, onSelect, table]
  )
  return {
    tabbable: focused !== undefined && visible.includes(focused) ? focused : visible[0],
    forest,
    openIds,
    filter,
    setFilter,
    kept,
    visible,
    setFocused,
    selected,
    toggle,
    select,
  }
}
