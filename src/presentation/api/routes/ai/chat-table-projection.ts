/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'

export interface ProjectedField {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string>
  readonly required?: boolean
}

export interface ProjectedTable {
  readonly name: string
  readonly fields: ReadonlyArray<ProjectedField>
  readonly permissions?: unknown
}

export interface ProjectTablesOptions {
  readonly includeRequired?: boolean
  readonly allowedTables?: ReadonlyArray<string>
}

interface RawField {
  readonly name: string
  readonly type: string
  readonly options?: unknown
  readonly required?: unknown
}

const projectField = (field: RawField, includeRequired: boolean): ProjectedField => ({
  name: field.name,
  type: field.type,
  ...(Array.isArray(field.options) ? { options: field.options as ReadonlyArray<string> } : {}),
  ...(includeRequired && typeof field.required === 'boolean' ? { required: field.required } : {}),
})

export const projectAppTables = (
  app: App | undefined,
  options: ProjectTablesOptions = {}
): ReadonlyArray<ProjectedTable> => {
  const { includeRequired = false, allowedTables } = options
  return (app?.tables ?? [])
    .filter((table) => allowedTables === undefined || allowedTables.includes(table.name))
    .map((table) => ({
      name: table.name,
      fields: table.fields.map((field) => projectField(field, includeRequired)),
      ...(table.permissions !== undefined && { permissions: table.permissions }),
    }))
}
