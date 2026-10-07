/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A list item opens its record the way a grid row does: the list's
 * `onRowClick` is the grid's — `openDrawer` opens the named drawer on the
 * item's record (the drawer then names itself and the record in the address,
 * `?record=<id>&drawer=<id>` — [internal ref]), `navigate` follows a path with the
 * item's `$record.*` values, and `fill` writes one of them into a form control
 * on the page (a composer's saved scripts).
 *
 * ONE handler, on the list: a click or an Enter lands on some element inside
 * an item, and the item it belongs to is found from the event, so a list of a
 * hundred items does not allocate a hundred closures per render.
 */

import { useCallback, type SyntheticEvent } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import { fillFromCard } from '../runtime/fill-dispatch'

type Row = Readonly<Record<string, unknown>>

interface RowClick {
  readonly type?: unknown
  readonly path?: unknown
  readonly target?: unknown
  readonly value?: unknown
  readonly action?: unknown
  readonly component?: unknown
}

/**
 * Run the list's row action for one record — the click a card takes, from the
 * one module the card islands share: a navigate path the record fills stays on
 * this site, and nothing the record holds can turn it into another origin or a
 * script.
 */
function runRowClick(click: RowClick, record: Row, table: string | undefined): void {
  if (click.type === 'navigate' && typeof click.path === 'string') {
    cardPathClick(substituteRecordVars(click.path, record))?.()
    return
  }
  if (click.type === 'fill') {
    fillFromCard(click, record)
    return
  }
  if (click.action === 'openDrawer' && typeof click.component === 'string') {
    openCardDrawer(click.component, record, table)
  }
}

/** The item an event landed on, as its index among the list's items. */
function itemIndexOf(event: SyntheticEvent<HTMLUListElement>): number {
  const item = (event.target as Element).closest('[data-list-item]')
  return item === null ? -1 : Array.prototype.indexOf.call(event.currentTarget.children, item)
}

/** The list's item handler, or `undefined` when it declares no `onRowClick`. */
export function useListRowClick(
  onRowClick: unknown,
  records: readonly Row[],
  table: string | undefined
): ((event: SyntheticEvent<HTMLUListElement>) => void) | undefined {
  const handler = useCallback(
    (event: SyntheticEvent<HTMLUListElement>) => {
      if ('key' in event && event.key !== 'Enter') return
      const record = records[itemIndexOf(event)]
      if (record !== undefined) runRowClick(onRowClick as RowClick, record, table)
    },
    [onRowClick, records, table]
  )
  return typeof onRowClick === 'object' && onRowClick !== null ? handler : undefined
}
