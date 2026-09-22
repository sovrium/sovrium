/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flattenRecordFields } from '@/domain/models/app/pages/record-envelope'

/** One fetched row, projected into something a sidebar can render as a link. */
export interface ProjectedEntry {
  readonly label: string
  readonly href: string
  readonly props?: Readonly<Record<string, unknown>>
}

/** The projection an endpoint's rows are read through. */
export interface RowProjection {
  readonly labelKey: string
  readonly hrefTemplate: string
  readonly itemProps?: Readonly<Record<string, unknown>>
}

/** Every `{field}` placeholder of a template. A STATIC literal. */
const PLACEHOLDER = /\{([^{}]+)\}/g

/**
 * Fill a template's `{field}` placeholders from one row.
 *
 * `encode` is the whole reason this takes an option rather than always doing
 * the safe-looking thing: an `hrefTemplate` builds a URL, where a value has to
 * be percent-encoded, while `itemProps` builds an ATTRIBUTE, where encoding
 * would turn `data-testid: nav-{name}` into `nav-my%20table` and make the row
 * unaddressable by the name the author wrote.
 *
 * Returns `undefined` when the row cannot fill every placeholder — a caller
 * that rendered the half-filled result would produce a dead link or a testid
 * with a literal `{name}` in it, both worse than one absent entry.
 */
export function fillRowTemplate(
  template: string,
  row: Readonly<Record<string, unknown>>,
  encode: boolean
): string | undefined {
  const values = [...template.matchAll(PLACEHOLDER)].map(([, field]) => row[field ?? ''])
  if (values.some((value) => typeof value !== 'string' && typeof value !== 'number')) {
    return undefined
  }
  return template.replaceAll(PLACEHOLDER, (_match, field: string) => {
    const value = String(row[field])
    return encode ? encodeURIComponent(value) : value
  })
}

/** Fill every value of an `itemProps` bag from the row. Non-string values pass through. */
function fillItemProps(
  itemProps: Readonly<Record<string, unknown>>,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(itemProps).map(([key, value]) => [
      key,
      typeof value === 'string' ? (fillRowTemplate(value, row, false) ?? value) : value,
    ])
  )
}

/**
 * Project one row into an entry, or `undefined` when it cannot become a link.
 *
 * A row with no usable label, or one whose `hrefTemplate` has a placeholder the
 * row cannot fill, is DROPPED rather than rendered as a dead or mislabelled
 * link — a navigation entry that goes nowhere is worse than one absent entry.
 *
 * The row is flattened first: a RECORD envelope nests its user fields under
 * `fields`, so `labelKey` and every `{field}` placeholder would read `undefined`
 * and the whole list would silently render empty. Lifting is what lets a sidebar
 * point at `/api/tables/:t/records` as readily as at an admin endpoint whose
 * rows are already flat.
 */
export function toProjectedEntry(
  row: Readonly<Record<string, unknown>>,
  projection: RowProjection
): ProjectedEntry | undefined {
  const flat = flattenRecordFields(row)
  const label = flat[projection.labelKey]
  if (typeof label !== 'string' || label.length === 0) return undefined

  const href = fillRowTemplate(projection.hrefTemplate, flat, true)
  if (href === undefined) return undefined

  return {
    label,
    href,
    ...(projection.itemProps === undefined
      ? {}
      : { props: fillItemProps(projection.itemProps, flat) }),
  }
}
