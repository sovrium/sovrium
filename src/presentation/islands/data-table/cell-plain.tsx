/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cells a column draws when it declares no type and no format of its own:
 * the value as text, or as chips when it is a list — and the one rule that
 * says which columns hold a list even when a row does not carry one.
 */

import { ArrayChipsCell } from './cell-renderers'
import type { DataTableCellContext } from './island/table-features'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** An entry of a listed value that is an object, e.g. a system row's `{ type, name }`. */
const isObjectEntry = (entry: unknown): entry is Readonly<Record<string, unknown>> =>
  typeof entry === 'object' && entry !== null

/** An object entry reads by its `label`, else its `name`; any other entry as itself. */
const entryText = (entry: unknown): string => {
  if (!isObjectEntry(entry)) return String(entry ?? '')
  return String(entry['label'] ?? entry['name'] ?? '')
}

/**
 * A column with no type and no format of its own: the value as text, as TanStack
 * prints it — except a LIST, which reads as one chip per entry (an object entry
 * by its label or name), and as the empty-cell dash when it holds nothing.
 * Printed as text, a list of objects read `[object Object]` and a list of
 * strings ran together as `a,b`.
 */
export const renderPlainCell = ({ getValue }: DataTableCellContext): React.ReactNode => {
  const value = getValue()
  if (Array.isArray(value)) return <ArrayChipsCell value={value.map(entryText)} />
  return value === undefined || value === null ? null : String(value)
}

/**
 * A column the grid itself edits as a LIST (a `multiple` row editor writes its
 * field): chips, and the empty-cell dash both for an empty list and for a value
 * the row does not carry. An absent list is one the server could not read, and
 * it must not read as blank text beside rows that print a dash for "none".
 */
export const renderListCell = ({ getValue }: DataTableCellContext): React.ReactNode => {
  const value = getValue()
  return <ArrayChipsCell value={Array.isArray(value) ? value.map(entryText) : value} />
}

/** The fields a `multiple` row editor in this grid writes — columns that hold a list. */
export const listEditedFields = (columns: readonly DataTableColumn[]): ReadonlySet<string> =>
  new Set(
    columns.flatMap((col) =>
      'field' in col
        ? []
        : col.actions.flatMap((item) =>
            item.editSelect?.multiple === true ? [item.editSelect.field] : []
          )
    )
  )
