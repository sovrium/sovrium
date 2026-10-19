/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'
import type { DataTableRowClickAction } from './data-row-types'
import type { DataTableRow } from './island/table-features'

/**
 * A `seek` row click: move the player it names to the moment the row holds,
 * through the always-loaded runtime's `sovrium:seek` listener. A moment that
 * reads as no number seeks nowhere.
 */
export function seekFromRow(
  action: Extract<DataTableRowClickAction, { readonly type: 'seek' }>,
  row: DataTableRow
): void {
  const fill = (template: string): string => substituteRecordVars(template, row.original)
  const text = typeof action.time === 'number' ? '' : fill(action.time).trim()
  const time = typeof action.time === 'number' ? action.time : text === '' ? NaN : Number(text)
  if (!Number.isFinite(time)) return
  dispatchIslandEvent('sovrium:seek', {
    target: fill(action.target),
    time,
    ...(action.play === false && { play: false }),
  })
}
