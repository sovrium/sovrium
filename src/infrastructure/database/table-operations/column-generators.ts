/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'

/**
 * Generate automatic id column definition based on primary key type
 * @param primaryKeyType - Type of primary key (uuid, bigserial, or default serial)
 * @param isPrimaryKey - Whether this id column is the primary key (adds PRIMARY KEY constraint inline)
 */
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
  return `id SERIAL NOT NULL${pkConstraint}`
}

/**
 * Determine if table needs an automatic id column
 * Creates automatic id column if:
 * - No explicit id field is defined in the fields array
 * - Either: no primary key is defined OR primary key references the special 'id' field
 */
export const needsAutomaticIdColumn = (
  table: Table,
  primaryKeyFields: readonly string[]
): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const primaryKeyReferencesId = primaryKeyFields.includes('id')
  const hasNonIdPrimaryKey = primaryKeyFields.length > 0 && !primaryKeyReferencesId
  return !hasIdField && !hasNonIdPrimaryKey
}

/**
 * Generate created_at column definition if not explicitly defined
 * Note: Includes DEFAULT CURRENT_TIMESTAMP to support INSERT ... DEFAULT VALUES
 * Triggers also set the value to ensure consistency
 */
export const generateCreatedAtColumn = (table: Table): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')
  return !hasCreatedAtField ? ['created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP'] : []
}

/**
 * Generate updated_at column definition if not explicitly defined
 * Note: Includes DEFAULT CURRENT_TIMESTAMP to support INSERT ... DEFAULT VALUES
 * Triggers update the value on INSERT and UPDATE to ensure currency
 */
export const generateUpdatedAtColumn = (table: Table): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')
  return !hasUpdatedAtField ? ['updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP'] : []
}

/**
 * Generate deleted_at column definition if not explicitly defined
 */
export const generateDeletedAtColumn = (table: Table): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === 'deleted_at')
  return !hasDeletedAtField ? ['deleted_at TIMESTAMPTZ'] : []
}

/**
 * Generate primary key constraint if needed
 */
export const generatePrimaryKeyConstraintIfNeeded = (
  table: Table,
  primaryKeyFields: readonly string[]
): readonly string[] =>
  needsAutomaticIdColumn(table, primaryKeyFields) && primaryKeyFields.length === 0
    ? ['PRIMARY KEY (id)']
    : []
