/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'

const ARRAY_TYPED_COLUMN_TYPES: ReadonlySet<string> = new Set(['multi-select'])

interface TableFieldShape {
  readonly name: string
  readonly type: string
}

const collectArrayTypedColumnNames = (
  app: Readonly<App>,
  tableName: string
): ReadonlySet<string> => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return new Set()
  const fields = (table.fields ?? []) as ReadonlyArray<TableFieldShape>
  const names = fields
    .filter((field) => ARRAY_TYPED_COLUMN_TYPES.has(field.type))
    .map((field) => field.name)
  return new Set(names)
}

export const coerceScalarsForArrayColumns = (
  fields: Readonly<Record<string, unknown>>,
  app: Readonly<App>,
  tableName: string
): Record<string, unknown> => {
  const arrayColumns = collectArrayTypedColumnNames(app, tableName)
  if (arrayColumns.size === 0) return { ...fields }
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]): readonly [string, unknown] => {
      if (!arrayColumns.has(key)) return [key, value]
      if (value === null || value === undefined) return [key, value]
      if (Array.isArray(value)) return [key, value]
      return [key, [value]]
    })
  )
}
