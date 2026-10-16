/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { useViewportBelow } from './use-narrow-viewport'
import type { DataTableIslandProps } from './island-props'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** Below `md` a phone has no room for a trailing column of buttons. */
const BELOW_MD_QUERY = '(max-width: 767.98px)'

type ActionColumn = Extract<DataTableColumn, { readonly type: 'actions' }>
type RowClick = NonNullable<DataTableIslandProps['onRowClick']>

type ItemAction = ActionColumn['actions'][number]['action']
type FetchItemAction = Extract<ItemAction, { readonly type: 'fetch' }>

/** A `fetch` that only drives the browser to its `url`. */
const isNavigateFetch = (action: ItemAction): action is FetchItemAction =>
  'type' in action && action.type === 'fetch' && action.mode === 'navigate'

const isActionColumn = (column: DataTableColumn): column is ActionColumn =>
  'type' in column && column.type === 'actions'

/**
 * The row's "Open", read off its action columns: the first item that only
 * NAVIGATES — a `fetch` in `navigate` mode that asks nothing first (`confirm`),
 * edits nothing (`editSelect`) and is on every row (`visibleWhen`). Anything
 * else is a gesture with a consequence, and a tap on a row must never be one.
 */
function openItemOf(columns: readonly DataTableColumn[]): RowClick | undefined {
  const item = columns
    .filter(isActionColumn)
    .flatMap((column) => column.actions)
    .find(
      ({ action, confirm, editSelect, visibleWhen }) =>
        isNavigateFetch(action) &&
        confirm === undefined &&
        editSelect === undefined &&
        visibleWhen === undefined
    )
  const action = item?.action
  if (action === undefined || !isNavigateFetch(action)) return undefined
  return action.openInNewTab === true
    ? { type: 'navigate', path: action.url, openInNewTab: true }
    : { type: 'navigate', path: action.url }
}

/**
 * The grid as a phone reads it.
 *
 * Below `md` the trailing action column is the part a phone cuts off, and the
 * row itself is the natural target for a thumb. So when the grid has somewhere
 * to OPEN a row — its declared `onRowClick`, else its action column's
 * navigate-only Open — the row becomes the tap target for it and every action
 * column is dropped; the actions stay reachable from what the row opens. A grid
 * with nowhere to open keeps its columns: its actions are then reached by
 * scrolling sideways, under the scroll edge.
 *
 * Above `md`, or with no open target, the props come back untouched.
 */
export function phoneRowOpen(props: DataTableIslandProps, belowMd: boolean): DataTableIslandProps {
  const { columns } = props
  if (!belowMd || columns === undefined || !columns.some(isActionColumn)) return props
  const onRowClick = props.onRowClick ?? openItemOf(columns)
  if (onRowClick === undefined) return props
  return { ...props, onRowClick, columns: columns.filter((column) => !isActionColumn(column)) }
}

/** {@link phoneRowOpen}, following the viewport live. */
export function usePhoneRowOpen(props: DataTableIslandProps): DataTableIslandProps {
  const belowMd = useViewportBelow(BELOW_MD_QUERY)
  return useMemo(() => phoneRowOpen(props, belowMd), [props, belowMd])
}
