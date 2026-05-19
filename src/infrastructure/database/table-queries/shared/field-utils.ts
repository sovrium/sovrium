/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/tables/fields'

export { sanitizeTableName } from '@/domain/utils/table-naming'

export const isManyToManyRelationship = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'relationship'
  relatedTable: string
  relationType: 'many-to-many'
} =>
  field.type === 'relationship' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string' &&
  'relationType' in field &&
  field.relationType === 'many-to-many'

export const shouldCreateDatabaseColumn = (field: Fields[number]): boolean => {
  if (field.type === 'button' || field.type === 'count') {
    return false
  }

  if (
    field.type === 'relationship' &&
    'relationType' in field &&
    field.relationType === 'one-to-many'
  ) {
    return false
  }

  if (isManyToManyRelationship(field)) {
    return false
  }

  return true
}
