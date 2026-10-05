/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import { resolveImageSource, substitute } from './card-template'
import type { TableRecord } from '../runtime/types'
import type { OptionChipColors } from '@/domain/kernel/color/option-chip-color'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

/**
 * What activating a card does, or `undefined` when the card declares no click
 * — or declares a navigate path that does not stay on this site.
 *
 * The two verbs a grid row takes: `navigate` follows the path with the card's
 * `$record.*` values (a `$param.*` token was already filled from the page
 * address at render), and `openDrawer` opens the named drawer on the card's
 * record — the drawer then names the record in the address (`?record=<id>`),
 * as it does for a grid row click. `table` is the board's bound table, which
 * the drawer needs to bind the record to its own table's forms alone.
 */
export function resolveCardActivation(
  onClick: KanbanCard['onClick'],
  record: TableRecord,
  table?: string
): (() => void) | undefined {
  if (!onClick) return undefined
  if ('action' in onClick) {
    const { component } = onClick
    return () => openCardDrawer(component, record, table)
  }
  return cardPathClick(substitute(onClick.path, record))
}

/** Resolve `colorField` to a stringified value or undefined when missing. */
export function resolveDataColor(card: KanbanCard, record: TableRecord): string | undefined {
  if (card.colorField === undefined) return undefined
  const colorValue = record[card.colorField]
  if (colorValue === null || colorValue === undefined || colorValue === '') return undefined
  return String(colorValue)
}

/**
 * Resolve the fill / label / border a card should PAINT for its `colorField`
 * value — the half {@link resolveDataColor} never supplied.
 *
 * `resolveDataColor` only ever put the raw value in a `data-color` attribute,
 * so a board configured with `card.colorField` looked wired while every card
 * stayed the same neutral surface. [internal ref] A7 ruling 1 makes a `colorField`
 * hue record DATA, so the author's declaration must reach the pixel.
 *
 * **Restore what was there; do not invent what wasn't.** That is the whole of
 * why this call passes an EMPTY fallback palette while calendar and timeline
 * pass a real one — the asymmetry is the rule, not an oversight, and it is not
 * safe to "fix" by handing kanban a palette too.
 *
 * Calendar and timeline were already painting a hue per value, badly: one
 * hashed the string, the other keyed on render order. Making them read the
 * author's declaration changes HOW they paint something they always painted.
 * A kanban card never painted a hue at all, so giving it a fallback palette
 * would not be honouring a declaration — it would be inventing appearance the
 * app author never asked for, on every board already in production. Ruling 5
 * makes declared colour an opt-in, and an opt-in that repaints the surfaces
 * that declined it is not one.
 *
 * So a board whose `colorField` names an UNCOLOURED field keeps today's
 * monochrome cards, with only the `data-color` attribute marking the value.
 * Declared colours still paint — that half is not optional.
 */
export function resolveCardColors(
  card: KanbanCard,
  record: TableRecord,
  optionColors: Readonly<Record<string, string>> | undefined
): OptionChipColors | undefined {
  const value = resolveDataColor(card, record)
  return value === undefined ? undefined : resolveRecordColor(value, optionColors, [])
}

/** Resolve `coverImage` template to a usable URL or undefined. */
export function resolveCoverImage(card: KanbanCard, record: TableRecord): string | undefined {
  // An attachment field draws its (first) file, as a gallery card's cover does.
  return card.coverImage === undefined ? undefined : resolveImageSource(card.coverImage, record)
}
