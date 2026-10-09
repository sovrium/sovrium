/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a list drawn from its declarative `itemTemplate` — title,
 * subtitle, image, badge and metadata — shared by the data-bound `list` and
 * the search list. The search list's free-form `childTemplate` rows stay in
 * `search/search-list-renderers.tsx`, so a `list` does not load them.
 */

import React from 'react'
import {
  substituteRecordVars,
  withDisplayLabels,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { isColumnFormat } from '@/domain/models/app/tables/column-format-validation'
import {
  LIST_TEXT_COLUMN_CLASSES,
  computeListBadgeClasses,
  computeListDividerClasses,
  computeListEmptyClasses,
  computeListItemClasses,
  computeListMetaClasses,
  computeListSubtitleClasses,
  computeListThumbClasses,
  computeListTitleClasses,
} from '@/presentation/design/list-default-classes'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { formatWeekdayDate, type WeekdayFields } from './weekday-dates'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { RecordTextFields } from '@/domain/models/app/tables/record-text-service'
import type { ListRowClasses } from '@/presentation/design/list-row-classes'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'

/**
 * What the server answered about the bound table's fields, so a row prints a
 * value as a grid cell prints it (`render/resolve/list-island-inputs.ts`).
 */
export interface ListRowInputs {
  readonly currencies?: Readonly<Record<string, CurrencyDisplayOptions>>
  /** The badge field's chip paints by value — the grid's chip for the same option. */
  readonly badgePaints?: Readonly<Record<string, OptionChipPaint>>
  readonly badgeField?: string
  /** The date fields that print their weekday — a metadata entry reads as the grid's cell. */
  readonly weekdays?: WeekdayFields
  /**
   * How each formatted field reads in an item's text — as the server prints it.
   * The list island attaches that text to each record it fetched; the search
   * list's records arrive with it.
   */
  readonly recordText?: RecordTextFields
  /**
   * A click (or Enter) on an item — one handler on the list, which finds the
   * item it landed on. Present only when the list declares `onRowClick`.
   */
  readonly onItemEvent?: (event: React.SyntheticEvent<HTMLUListElement>) => void
  /** The row's classes by part — `itemLayout` and the author's parts, resolved server-side. */
  readonly rowClasses?: ListRowClasses
  /** The shell `<ul>`'s classes when the author styles its `list` part, resolved server-side. */
  readonly listClasses?: string
  /** The list's accessible name — the author's `props.aria-label`, carried by the host. */
  readonly ariaLabel?: string
  /**
   * The list reads the reader's own sessions (`dataSource: { auth: sessions }`):
   * each item then says whether it is the session reading the page, as
   * `data-session-current`, from the row's `current`.
   */
  readonly accountSessions?: boolean
}

export interface ItemTemplate {
  readonly title?: string
  readonly subtitle?: string
  readonly image?: string
  readonly badge?: string
  readonly metadata?: readonly {
    readonly field: string
    readonly format?: string
    /** The entry's own classes, after the meta group's look (`metadata[].className`). */
    readonly className?: string
  }[]
}

// Item-template rendering (declarative title/subtitle/image/badge/metadata)
//
// Every class below comes from `list-default-classes.ts`. Before wave R-D this
// renderer emitted NO classes at all, so a data-bound list painted as the
// browser's default bulleted list — indented behind a disc, on no surface.
//
// The `data-list-*` attributes are the selector contract the specs assert on
// (`[data-list-item]`, `[data-list-title]`, `[data-list-subtitle]`,
// `[data-list-badge]`, `[data-list-meta=<field>]`) and are untouched: each one
// still sits on the same element, in the same order.

/**
 * The trailing metadata group.
 *
 * Wrapped in a row of its own so the values sit on the canvas' 6px gap rather
 * than inheriting the item's 10px — they are one group (`4 items · 2 days
 * ago`), not peers of the title and the badge. The wrapper is omitted entirely
 * when no declared field resolved, so an item without metadata pays no gap for
 * an empty box.
 *
 * The declared index is preserved through the filter so React keys stay stable
 * when a nullable column drops out of one record and not another.
 */
/**
 * One metadata value, written in the format its entry declares when that is a
 * value format (`currency`, `relative-date`, `short-date`…), in the page's
 * language — the same formatter a data-table cell uses, so a list row and a
 * grid row print one value one way. Any other word (`badge`, `text`) leaves
 * the value as it is.
 */
function formatMetadataValue(
  value: unknown,
  format: string | undefined,
  currency: CurrencyDisplayOptions | undefined
): string {
  return isColumnFormat(format)
    ? formatCellValue(value, format, resolvePageLocale(), {
        timeZone: resolvePageTimezone(),
        currency,
      })
    : // An empty value (an unlinked lookup reads NULL) prints nothing, never `null`.
      String(value ?? '')
}

function renderItemMetadata(
  metadata: ItemTemplate['metadata'],
  record: Record<string, unknown>,
  inputs: ListRowInputs | undefined,
  { key, className }: { readonly key: string; readonly className: string }
): React.ReactNode {
  const entries = (metadata ?? [])
    .map((meta, index) => ({ meta, index }))
    .filter(({ meta }) => record[meta.field] !== undefined)
  if (entries.length === 0) return undefined
  return (
    <div className={className}>
      {entries.map(({ meta, index }) => (
        <span
          key={`${key}-meta-${index}`}
          data-list-meta={meta.field}
          className={meta.className}
        >
          {formatWeekdayDate(meta.field, record[meta.field], inputs?.weekdays) ??
            formatMetadataValue(record[meta.field], meta.format, inputs?.currencies?.[meta.field])}
        </span>
      ))}
    </div>
  )
}

/**
 * The item's slots, substituted. The text slots are TEXT sites: a relationship
 * reads as its `displayField` label, a user field as the account's name, and a
 * formatted field (a date, an amount, an option) as the server prints it.
 * `image` is an ADDRESS site and keeps the stored value (see `withDisplayLabels`).
 */
function resolveItemSlots(template: ItemTemplate, record: Record<string, unknown>) {
  const labelled = withDisplayLabels(record)
  const text = withRecordText(labelled)
  const sub = (field: string | undefined, source: Readonly<Record<string, unknown>>) =>
    field ? substituteRecordVars(field, source) : undefined
  return {
    labelled,
    title: sub(template.title, text),
    image: sub(template.image, record),
    subtitle: sub(template.subtitle, text),
    badge: sub(template.badge, text),
  }
}

/**
 * The item's badge. Bound to an option field, it is the grid's chip for the
 * same value — its colour, or the neutral outline, in the app's badge form —
 * from the paints the server resolved (`list-island-inputs.ts`).
 */
function renderItemBadge(
  badge: string,
  record: Record<string, unknown>,
  inputs: ListRowInputs | undefined
): React.ReactNode {
  const field = inputs?.badgeField
  const paint = field === undefined ? undefined : inputs?.badgePaints?.[String(record[field])]
  return (
    <span
      data-list-badge="true"
      data-component-type="badge"
      className={computeListBadgeClasses()}
      style={paint?.style}
    >
      {paint?.dot && (
        <span
          data-badge-dot=""
          className={paint.dot.className}
          style={paint.dot.style}
        />
      )}
      {badge}
    </span>
  )
}

/**
 * The row's classes: the server-resolved ones (layout and author parts, merged
 * there), else the recipe's — joined here without the class merger, which would
 * add ~27 KB to every island that draws a row.
 */
const rowClassesOf = (inputs: ListRowInputs | undefined): ListRowClasses =>
  inputs?.rowClasses ?? {
    item: `${computeListItemClasses()} ${computeListDividerClasses()}`,
    textColumn: LIST_TEXT_COLUMN_CLASSES,
    title: computeListTitleClasses(),
    subtitle: computeListSubtitleClasses(),
    meta: computeListMetaClasses(),
  }

/** `data-session-current` for an item of the reader's sessions list, else nothing. */
const sessionMarker = (
  record: Record<string, unknown>,
  inputs: ListRowInputs | undefined
): Readonly<Record<string, string>> =>
  inputs?.accountSessions === true && typeof record['current'] === 'boolean'
    ? { 'data-session-current': String(record['current']) }
    : {}

export function renderItemTemplate(
  template: ItemTemplate,
  record: Record<string, unknown>,
  key: string,
  inputs: ListRowInputs | undefined
): React.ReactNode {
  const { labelled, title, image, subtitle, badge } = resolveItemSlots(template, record)
  const classes = rowClassesOf(inputs)
  return (
    <li
      key={key}
      data-list-item="true"
      tabIndex={inputs?.onItemEvent === undefined ? undefined : 0}
      className={classes.item}
      {...sessionMarker(record, inputs)}
    >
      {image ? (
        <img
          src={image}
          alt={title ?? ''}
          className={computeListThumbClasses()}
        />
      ) : undefined}
      {/* The one element R-D adds to this template: title and subtitle are
          siblings of the row's own row-direction flex, so without a column
          wrapper they lay out side by side instead of stacking. Rendered only
          when at least one of them exists, so a badge-only row is not pushed
          right by an empty `flex-1` box. */}
      {title !== undefined || subtitle !== undefined ? (
        <div className={classes.textColumn}>
          {title ? (
            <span
              data-list-title="true"
              className={classes.title}
            >
              {title}
            </span>
          ) : undefined}
          {subtitle ? (
            <span
              data-list-subtitle="true"
              className={classes.subtitle}
            >
              {subtitle}
            </span>
          ) : undefined}
        </div>
      ) : undefined}
      {badge ? renderItemBadge(badge, record, inputs) : undefined}
      {renderItemMetadata(template.metadata, labelled, inputs, { key, className: classes.meta })}
    </li>
  )
}

/** The list's empty message, in place of an empty list. */
export function renderEmptyList(emptyMessage: string, ariaLabel?: string): React.ReactElement {
  // A named list stays a list when it is empty: the reader is told the list
  // is there, and holds only the message.
  if (ariaLabel !== undefined)
    return (
      <ul aria-label={ariaLabel}>
        <li
          data-list-empty="true"
          className={computeListEmptyClasses()}
        >
          {emptyMessage}
        </li>
      </ul>
    )
  return (
    <p
      data-list-empty="true"
      className={computeListEmptyClasses()}
    >
      {emptyMessage}
    </p>
  )
}
