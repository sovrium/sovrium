/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The option-badge paints a list or a board draws, resolved on the server.
 *
 * A list item's badge and a kanban footer badge are one chip with the grid's
 * status pill: the same option colour, the same neutral chip for an
 * option without one, in the form `design.badgeForm` picks. The colour
 * arithmetic runs HERE, from the field's declared options, and the islands
 * receive a finished `value → paint` map — which keeps it out of their payload.
 */

import { optionColor, optionValue } from '@/domain/models/app/tables/select-option'
import {
  resolveOptionChipPaint,
  type BadgeForm,
  type ChipSurface,
  type OptionChipPaint,
} from '@/presentation/design/option-chip-paint'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** Field types whose value is one option drawn as a chip. */
const OPTION_FIELD_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/** One `value → paint` map. */
export type OptionBadgePaints = Readonly<Record<string, OptionChipPaint>>

/**
 * The paint of every declared option of `fieldName`, or `undefined` when the
 * field is not an option field of `table`. `surface` is the chip the paint
 * lands on: a list or board chip (the default), or the grid's pill — which a
 * read-only record drawer draws too, so a value reads the same in both.
 */
export function resolveOptionBadgePaints(
  table: Tables[number],
  fieldName: string,
  form: BadgeForm | undefined,
  surface: ChipSurface = 'chip'
): OptionBadgePaints | undefined {
  const field = table.fields.find((candidate) => candidate.name === fieldName)
  if (field === undefined || !OPTION_FIELD_TYPES.has(field.type)) return undefined
  const options = 'options' in field && Array.isArray(field.options) ? field.options : []
  return Object.fromEntries(
    options.flatMap((option) => {
      const paint = resolveOptionChipPaint(optionColor(option), form, surface)
      return paint === undefined ? [] : [[optionValue(option), paint] as const]
    })
  )
}

/**
 * Carry `design.badgeForm` to the grid: every option field's display meta
 * names the form, so the grid's status pill draws the same chip the list and
 * the board draw. Untouched when the app keeps the default form.
 */
export function withGridBadgeForm<
  T extends { readonly dataTableFieldMeta: Record<string, unknown> | undefined },
>(inputs: T, form: BadgeForm | undefined): T {
  const fieldMeta = inputs.dataTableFieldMeta
  if (fieldMeta === undefined || form !== 'outline-dot') return inputs
  const dataTableFieldMeta = Object.fromEntries(
    Object.entries(fieldMeta).map(([name, meta]) => {
      const entry = meta as { readonly type?: string; readonly display?: object }
      if (entry.type === undefined || !OPTION_FIELD_TYPES.has(entry.type)) return [name, meta]
      return [name, { ...entry, display: { ...entry.display, badgeForm: form } }]
    })
  )
  return { ...inputs, dataTableFieldMeta }
}

/** One kanban footer entry, as the board declares it. */
interface FooterItem {
  readonly field: string
  readonly format?: string
}

/**
 * Give each `format: badge` footer column on an option field its paints, so a
 * board's footer badge draws the grid's chip for the same value.
 */
function withFooterBadgePaints(
  fieldMeta: Record<string, unknown>,
  table: Tables[number],
  footer: readonly FooterItem[],
  form: BadgeForm | undefined
): Record<string, unknown> {
  const badges = new Set(footer.filter((item) => item.format === 'badge').map((i) => i.field))
  return Object.fromEntries(
    Object.entries(fieldMeta).map(([field, meta]) => {
      const paints = badges.has(field) ? resolveOptionBadgePaints(table, field, form) : undefined
      return [field, paints === undefined ? meta : { ...(meta as object), paints }]
    })
  )
}

/**
 * The field metadata of the columns a kanban card's FOOTER names — the same
 * entries the grid receives, narrowed to what the footer can print, so a
 * `currency` item formats with the column's own currency, precision and
 * separators without the whole table's schema riding along in the page, and a
 * `badge` item on an option field carries its paints. Absent when the card
 * declares no footer.
 */
export function resolveKanbanFooterFieldMeta(
  fieldMeta: Record<string, unknown> | undefined,
  table: Tables[number],
  component: Component,
  form: BadgeForm | undefined
): Record<string, unknown> | undefined {
  const footer = (component as { readonly card?: { readonly footer?: readonly FooterItem[] } }).card
    ?.footer
  if (!footer || footer.length === 0) return undefined
  const named = new Set(footer.map((item) => item.field))
  const narrowed = Object.fromEntries(
    Object.entries(fieldMeta ?? {}).filter(([field]) => named.has(field))
  )
  return withFooterBadgePaints(narrowed, table, footer, form)
}
