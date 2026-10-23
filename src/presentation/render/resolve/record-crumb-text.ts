/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { withRecordText } from '@/domain/models/app/pages/substitute-record-vars'
import { substituteRecordVars } from '@/presentation/render/resolve/data-source-contracts'
import { RECORD_DISPLAY_KEY, recordDisplayOf } from './record-display-labels'

/**
 * The words a page record prints in a caption — a breadcrumb's crumbs, a tab
 * set's labels: each value as text, a linked record by its display field.
 */

/**
 * A record projected for a breadcrumb's words: {@link withRecordText}, and
 * every field the record carries a display label for — a relationship's linked
 * record by its display field, a `user` field's person by name — prints that
 * label, as the description list beside it does; `<field>.raw` keeps the
 * stored value.
 */
export function withCrumbText(
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const prose = withRecordText(record)
  const block = record[RECORD_DISPLAY_KEY]
  if (block === null || typeof block !== 'object') return prose
  const labelled = Object.keys(block).flatMap((field) => {
    const label = recordDisplayOf(record, field)
    return label === undefined ? [] : [[field, label] as const]
  })
  return {
    ...prose,
    ...Object.fromEntries(labelled.map(([field]) => [`${field}.raw`, record[field]])),
    ...Object.fromEntries(labelled),
  }
}

/**
 * An enumerated breadcrumb's crumbs filled from the record: each `label` is
 * prose and prints a value formatted — a linked record by its display field —
 * as a derived trail's `currentLabel` does; an `href` keeps the stored value.
 * `undefined` when there are no crumbs.
 */
export function substituteRecordInCrumbs(
  crumbs: unknown,
  record: Record<string, unknown>
): unknown {
  if (!Array.isArray(crumbs)) return undefined
  const prose = withCrumbText(record)
  return crumbs.map((crumb: unknown) => {
    if (crumb === null || typeof crumb !== 'object') return crumb
    const { label } = crumb as { readonly label?: unknown }
    return {
      ...(mapStringsDeep(crumb, (value) => substituteRecordVars(value, record)) as object),
      ...(typeof label === 'string' && { label: substituteRecordVars(label, prose) }),
    }
  })
}

/**
 * A tab set's captions read the page record as words, like a breadcrumb's:
 * `Editor · $record.pending_changes` reaches the document as `Editor · 2`.
 */
export function substituteRecordInPanels(
  panels: unknown,
  record: Record<string, unknown>
): unknown {
  if (!Array.isArray(panels)) return undefined
  const prose = withCrumbText(record)
  const fill = (value: unknown): unknown =>
    typeof value === 'string' ? substituteRecordVars(value, prose) : value
  return panels.map((panel: unknown) =>
    panel === null || typeof panel !== 'object'
      ? panel
      : {
          ...panel,
          label: fill((panel as { readonly label?: unknown }).label),
          ...('description' in panel && {
            description: fill((panel as { readonly description?: unknown }).description),
          }),
        }
  )
}
