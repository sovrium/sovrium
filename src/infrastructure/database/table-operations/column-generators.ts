/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/tables'

export const generateIdColumn = (
  primaryKeyType: string | undefined,
  isPrimaryKey: boolean
): string => {
  const pkConstraint = isPrimaryKey ? ' PRIMARY KEY' : ''
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

export const needsAutomaticIdColumn = (
  table: Table,
  primaryKeyFields: readonly string[]
): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const primaryKeyReferencesId = primaryKeyFields.includes('id')
  const hasNonIdPrimaryKey = primaryKeyFields.length > 0 && !primaryKeyReferencesId
  return !hasIdField && !hasNonIdPrimaryKey
}

export const generateCreatedAtColumn = (table: Table): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')
  return !hasCreatedAtField ? ['created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP'] : []
}

export const generateUpdatedAtColumn = (table: Table): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')
  return !hasUpdatedAtField ? ['updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP'] : []
}

export const generateDeletedAtColumn = (table: Table): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === 'deleted_at')
  return !hasDeletedAtField ? ['deleted_at TIMESTAMPTZ'] : []
}

export const generatePrimaryKeyConstraintIfNeeded = (
  table: Table,
  primaryKeyFields: readonly string[]
): readonly string[] =>
  needsAutomaticIdColumn(table, primaryKeyFields) && primaryKeyFields.length === 0
    ? ['PRIMARY KEY (id)']
    : []
