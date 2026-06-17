/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQLITE_ISO_NOW } from '@/infrastructure/database/sql/dialect-ddl'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { Table } from '@/domain/models/app/tables'

const timestampDefaultClause = (): string =>
  isSqliteRuntime() ? `DEFAULT (${SQLITE_ISO_NOW})` : 'DEFAULT CURRENT_TIMESTAMP'

const SQLITE_UUID_DEFAULT = 'lower(hex(randomblob(16)))'

export const generateIdColumn = (
  primaryKeyType: string | undefined,
  isPrimaryKey: boolean
): string => {
  const pkConstraint = isPrimaryKey ? ' PRIMARY KEY' : ''

  if (isSqliteRuntime()) {
    if (primaryKeyType === 'uuid' || primaryKeyType === 'text') {
      return `id TEXT NOT NULL DEFAULT (${SQLITE_UUID_DEFAULT})${pkConstraint}`
    }
    return isPrimaryKey ? `id INTEGER PRIMARY KEY AUTOINCREMENT` : `id INTEGER NOT NULL`
  }

  if (primaryKeyType === 'uuid') {
    return `id UUID NOT NULL DEFAULT gen_random_uuid()${pkConstraint}`
  }
  if (primaryKeyType === 'bigserial') {
    return `id BIGSERIAL NOT NULL${pkConstraint}`
  }
  if (primaryKeyType === 'text') {
    return `id TEXT NOT NULL DEFAULT gen_random_uuid()::text${pkConstraint}`
  }
  return `id SERIAL NOT NULL${pkConstraint}`
}

export const resolvePrimaryKeyColumnType = (primaryKeyType: string | undefined): string => {
  if (primaryKeyType === 'uuid') return isSqliteRuntime() ? 'TEXT' : 'UUID'
  if (primaryKeyType === 'text') return 'TEXT'
  if (primaryKeyType === 'bigserial') return isSqliteRuntime() ? 'INTEGER' : 'BIGINT'
  return 'INTEGER'
}

export const needsAutomaticIdColumn = (
  table: Table,
  primaryKeyFields: readonly string[]
): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const primaryKeyReferencesId = primaryKeyFields.includes('id')
  const hasNonIdPrimaryKey = primaryKeyFields.length > 0 && !primaryKeyReferencesId
  return !hasIdField && !hasNonIdPrimaryKey
}

const timestampColumnType = (): string => (isSqliteRuntime() ? 'TEXT' : 'TIMESTAMPTZ')

export const generateCreatedAtColumn = (table: Table): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')
  return !hasCreatedAtField
    ? [`created_at ${timestampColumnType()} NOT NULL ${timestampDefaultClause()}`]
    : []
}

export const generateUpdatedAtColumn = (table: Table): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')
  return !hasUpdatedAtField
    ? [`updated_at ${timestampColumnType()} NOT NULL ${timestampDefaultClause()}`]
    : []
}

export const generateDeletedAtColumn = (table: Table): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === 'deleted_at')
  return !hasDeletedAtField ? [`deleted_at ${timestampColumnType()}`] : []
}

export const generatePrimaryKeyConstraintIfNeeded = (
  table: Table,
  primaryKeyFields: readonly string[]
): readonly string[] => {
  if (!needsAutomaticIdColumn(table, primaryKeyFields) || primaryKeyFields.length > 0) {
    return []
  }
  return []
}
