/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { withDisplayLabels } from '@/domain/models/app/pages/substitute-record-vars'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import {
  KANBAN_FOOTER_AVATAR_CLASSES,
  computeKanbanCardFooterChipClasses,
  computeKanbanFooterBadgeClasses,
} from '@/presentation/design/kanban-default-classes'
import { resolvePageTimezone } from '../runtime/page-timezone'
import type { KanbanFormat } from './use-kanban-format'
import type { TableRecord } from '../runtime/types'
import type { KanbanCardFooterItem } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactNode } from 'react'

/** A footer date, short, in the page's language — « 18 mars 2026 » on a French page. */
export function formatShortDate(value: unknown, locale: string): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(usableLocale(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

/**
 * Render a single footer item per its format. Falls back to plain text when
 * format is unset or unrecognized.
 *
 * Every format now spends the shared chip recipe: 11px on the muted tone at the
 * canvas' 6px inner gap, down from the `text-sm` (12px) that made footer
 * metadata render at the same step as the card title above it. The `badge`
 * format routes to the shared badge recipe rather than keeping its bespoke
 * `rounded-full` pill — the same argument that retired the column count's pill,
 * applied to the last chip on this board.
 *
 * The `data-footer-format` attributes are untouched; specs select on them.
 */
/**
 * The text a PLAIN chip prints, per format — every format but `avatar` and
 * `badge`, which draw their own shapes.
 *
 * `relative-date` is signed and in the page's language — « dans 3 j » on a
 * French page — through the grid's own `relative-time` formatter, which rounds
 * to the nearest day where the English-only copy it replaced rounded down.
 * `currency` uses the column's own currency, precision and separators, and the
 * page language where the field declares no separator — exactly as the grid's
 * `format: currency` cell and its summary row print the same amount.
 */
function plainChipText(
  item: KanbanCardFooterItem,
  stored: unknown,
  label: unknown,
  format: KanbanFormat
): string {
  switch (item.format) {
    case 'relative-date':
      return formatCellValue(stored, 'relative-time', format.locale)
    case 'currency':
      return formatCellValue(stored, 'currency', format.locale, {
        currency: format.currencyOptionsFor(item.field),
        timeZone: resolvePageTimezone(),
      })
    case 'short-date':
      return formatShortDate(stored, format.locale)
    default:
      return String(label)
  }
}

export function renderFooterItem(
  item: KanbanCardFooterItem,
  record: TableRecord,
  format: KanbanFormat
): ReactNode {
  const stored = record[item.field]
  if (stored === undefined || stored === null || stored === '') return undefined
  // The chips that print a WORD are text sites, so a relationship reads as its
  // `displayField` label; the dates and the amount format the stored value.
  const label = String(withDisplayLabels(record)[item.field])

  if (item.format === 'avatar') {
    return (
      <span
        data-footer-format="avatar"
        className={computeKanbanCardFooterChipClasses()}
      >
        <span
          className={KANBAN_FOOTER_AVATAR_CLASSES}
          aria-hidden="true"
        >
          {avatarInitials(label)}
        </span>
        <span>{label}</span>
      </span>
    )
  }
  if (item.format === 'badge') {
    return (
      <span
        data-footer-format="badge"
        className={computeKanbanFooterBadgeClasses()}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      data-footer-format={item.format ?? 'text'}
      className={computeKanbanCardFooterChipClasses()}
    >
      {plainChipText(item, stored, label, format)}
    </span>
  )
}
