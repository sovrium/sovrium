/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import { substitute } from './card-template'
import type { TableRecord } from '../runtime/types'
import type { OptionChipColors } from '@/domain/kernel/color/option-chip-color'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

/**
 * Pull the navigate path out of a card.onClick action and substitute
 * $record.X tokens. Returns undefined when the action isn't a navigate.
 */
export function resolveNavigatePath(
  onClick: KanbanCard['onClick'],
  record: TableRecord
): string | undefined {
  if (!onClick || !('type' in onClick) || onClick.type !== 'navigate') return undefined
  return substitute(onClick.path, record)
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
  if (card.coverImage === undefined) return undefined
  const resolved = substitute(card.coverImage, record)
  // Drop empty string (e.g. when thumbnail field is null) so we don't render a
  // broken `<img src="">` element that would still trip toBeVisible() checks.
  return resolved === '' ? undefined : resolved
}

/** Imperative SPA navigation. Wrapped to keep mutating call out of JSX. */
export function navigateTo(path: string): void {
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    globalThis.location.assign(path)
  }
}
