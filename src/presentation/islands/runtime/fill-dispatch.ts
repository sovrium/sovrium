/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The island side of the `fill` action — a list item click, a board drop hook.
 * Apart from `card-click.ts` so the card islands that never fill (gallery,
 * calendar) do not carry it.
 *
 * The event is the bus's own `dispatch`, spelled inline for the reason
 * `card-click.ts` gives: importing the event-bus module from a card island
 * moves a shared chunk boundary.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { FillDetail } from './event-bus'
import type { TableRecord } from './types'

/** A `fill` action as config hands it over — read loosely, checked here. */
interface CardFill {
  readonly target?: unknown
  readonly field?: unknown
  readonly value?: unknown
  readonly mode?: unknown
}

/**
 * Fill a form control on the page with a value of a card's record (a list item
 * click, a board drop hook). The value is resolved HERE, against the record
 * the island holds, and handed to the always-loaded runtime's `sovrium:fill`
 * listener, which writes it as text.
 */
export function fillFromCard(fill: CardFill, record: TableRecord): void {
  if (typeof fill.target !== 'string' || typeof fill.value !== 'string') return
  const detail = {
    target: fill.target,
    value: substituteRecordVars(fill.value, record),
    ...(typeof fill.field === 'string' && { field: fill.field }),
    ...(fill.mode === 'append' && { mode: 'append' as const }),
  } satisfies FillDetail
  document.dispatchEvent(new CustomEvent('sovrium:fill', { detail }))
}
