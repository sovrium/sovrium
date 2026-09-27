/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
import {
  substituteRecordVars,
  withDisplayLabels,
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
  computeListShellClasses,
  computeListSubtitleClasses,
  computeListThumbClasses,
  computeListTitleClasses,
} from '@/presentation/design/list-default-classes'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolvePageTimezone } from '../runtime/page-timezone'

export type ChildTemplate = readonly (ChildNode | string)[]

export interface ChildNode {
  readonly type: string
  readonly props?: Record<string, unknown>
  readonly content?: string
  readonly children?: ChildTemplate
}

export interface ItemTemplate {
  readonly title?: string
  readonly subtitle?: string
  readonly image?: string
  readonly badge?: string
  readonly metadata?: readonly { readonly field: string; readonly format?: string }[]
}

/**
 * Record substitution — re-exported from the ONE implementation in
 * `@/domain/utils/substitute-record-vars`, which is `effect`-free and already
 * the browser-reachable home for helpers like this one.
 *
 * The local copy this replaces rendered an explicit `null` as the literal text
 * `null`, so a nullable column reached a search result as the word. It also had
 * no fallback chain, so `$record.title|$record.slug` was inert here while it
 * worked on the server.
 */
export { substituteRecordVars }

function substituteChildProps(
  props: Record<string, unknown> | undefined,
  record: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props) return props
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecordVars(value, record) : value,
    ])
  )
}

export function substituteChildTemplate(
  template: ChildTemplate,
  record: Record<string, unknown>
): ChildTemplate {
  return template.map((child) => {
    if (typeof child === 'string') return substituteRecordVars(child, record)
    return {
      ...child,
      props: substituteChildProps(child.props, record),
      content:
        typeof child.content === 'string'
          ? substituteRecordVars(child.content, record)
          : child.content,
      children: child.children ? substituteChildTemplate(child.children, record) : child.children,
    }
  })
}

// Schema type → HTML tag mapping
const TYPE_TO_TAG: Record<string, string> = {
  text: 'span',
  container: 'div',
  card: 'div',
  list: 'ul',
  li: 'li',
  link: 'a',
  button: 'button',
  image: 'img',
}

// Render child template to JSX
export function renderChild(child: ChildNode | string, key: string): React.ReactNode {
  if (typeof child === 'string') return child

  const { type: schemaType, props = {}, content, children } = child
  const type = TYPE_TO_TAG[schemaType] ?? schemaType
  const {
    id,
    className,
    'data-testid': testid,
    ...rest
  } = props as {
    id?: string
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }

  const renderedChildren = children
    ? children.map((c, i) => renderChild(c, `${key}-${i}`))
    : undefined
  const inner = content ?? renderedChildren ?? undefined

  return React.createElement(type, { key, id, className, 'data-testid': testid, ...rest }, inner)
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
function formatMetadataValue(value: unknown, format: string | undefined): string {
  return isColumnFormat(format)
    ? formatCellValue(value, format, resolvePageLocale(), { timeZone: resolvePageTimezone() })
    : String(value)
}

function renderItemMetadata(
  metadata: ItemTemplate['metadata'],
  record: Record<string, unknown>,
  key: string
): React.ReactNode {
  const entries = (metadata ?? [])
    .map((meta, index) => ({ meta, index }))
    .filter(({ meta }) => record[meta.field] !== undefined)
  if (entries.length === 0) return undefined
  return (
    <div className={computeListMetaClasses()}>
      {entries.map(({ meta, index }) => (
        <span
          key={`${key}-meta-${index}`}
          data-list-meta={meta.field}
        >
          {formatMetadataValue(record[meta.field], meta.format)}
        </span>
      ))}
    </div>
  )
}

/**
 * The item's slots, substituted. The text slots are TEXT sites: a relationship
 * reads as its `displayField` label and a user field as the account's name.
 * `image` is an ADDRESS site and keeps the stored value (see `withDisplayLabels`).
 */
function resolveItemSlots(template: ItemTemplate, record: Record<string, unknown>) {
  const labelled = withDisplayLabels(record)
  const sub = (field: string | undefined, source: Readonly<Record<string, unknown>>) =>
    field ? substituteRecordVars(field, source) : undefined
  return {
    labelled,
    title: sub(template.title, labelled),
    image: sub(template.image, record),
    subtitle: sub(template.subtitle, labelled),
    badge: sub(template.badge, labelled),
  }
}

function renderItemTemplate(
  template: ItemTemplate,
  record: Record<string, unknown>,
  key: string
): React.ReactNode {
  const { labelled, title, image, subtitle, badge } = resolveItemSlots(template, record)
  return (
    <li
      key={key}
      data-list-item="true"
      className={`${computeListItemClasses()} ${computeListDividerClasses()}`}
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
        <div className={LIST_TEXT_COLUMN_CLASSES}>
          {title ? (
            <span
              data-list-title="true"
              className={computeListTitleClasses()}
            >
              {title}
            </span>
          ) : undefined}
          {subtitle ? (
            <span
              data-list-subtitle="true"
              className={computeListSubtitleClasses()}
            >
              {subtitle}
            </span>
          ) : undefined}
        </div>
      ) : undefined}
      {badge ? (
        <span
          data-list-badge="true"
          className={computeListBadgeClasses()}
        >
          {badge}
        </span>
      ) : undefined}
      {renderItemMetadata(template.metadata, labelled, key)}
    </li>
  )
}

interface ResultsBodyProps {
  readonly records: readonly Record<string, unknown>[]
  readonly emptyMessage?: string
  readonly itemTemplate?: ItemTemplate
  readonly childTemplate: ChildTemplate
}

export function renderResultsBody({
  records,
  emptyMessage,
  itemTemplate,
  childTemplate,
}: ResultsBodyProps): React.ReactNode {
  if (records.length === 0 && emptyMessage) {
    return (
      <p
        data-list-empty="true"
        className={computeListEmptyClasses()}
      >
        {emptyMessage}
      </p>
    )
  }
  return (
    <ul className={computeListShellClasses()}>
      {records.map((record, i) =>
        itemTemplate ? (
          renderItemTemplate(itemTemplate, record, `item-${i}`)
        ) : (
          // A `childTemplate` row carries the same geometry as an
          // `itemTemplate` row — the two differ in what they render INSIDE the
          // row, not in what a row is — so both sit on the shell identically.
          <li
            key={i}
            className={`${computeListItemClasses()} ${computeListDividerClasses()}`}
          >
            {childTemplate.map((child, j) => {
              const substituted = substituteChildTemplate([child], record)[0]
              return substituted ? renderChild(substituted, `${i}-${j}`) : undefined
            })}
          </li>
        )
      )}
    </ul>
  )
}
