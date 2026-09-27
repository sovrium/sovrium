/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from './types'

/**
 * The label the records API resolved for a field, when it resolved one: a
 * relationship whose field declared a `displayField`, or an account a `user`
 * field stores.
 *
 * A relationship or user column stores a key, so anything rendering the stored
 * value shows an identifier. `_display` carries the resolved label ALONGSIDE
 * that key — a string for a to-one field, a list for a to-many one — and is
 * absent for a field that declared nothing, which is what keeps the identifier
 * showing rather than a label the author never asked for.
 *
 * One reader for every island: a grid cell, a grid group header, a chart
 * category and a timeline lane over the same field must name the same record
 * the same way.
 */
export function readDisplayLabel(record: TableRecord, field: string): unknown {
  const display = record['_display']
  if (typeof display !== 'object' || display === null) return undefined
  return (display as Record<string, unknown>)[field]
}

/**
 * The resolved label of `field` as one line of text — a list's labels joined
 * by commas — or `undefined` when the records API resolved none.
 */
export function readDisplayText(record: TableRecord, field: string): string | undefined {
  const label = readDisplayLabel(record, field)
  if (typeof label === 'string') return label === '' ? undefined : label
  if (Array.isArray(label)) {
    const parts = label.filter((part): part is string => typeof part === 'string')
    return parts.length === 0 ? undefined : parts.join(', ')
  }
  return undefined
}
