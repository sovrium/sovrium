/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/tables/fields'

export const isUserReferenceField = (field: Fields[number]): boolean =>
  field.type === 'created-by' || field.type === 'updated-by' || field.type === 'deleted-by'

export const isAutoPopulatedUserField = (field: Fields[number]): boolean =>
  field.type === 'created-by'

export const isUserField = (field: Fields[number]): boolean => field.type === 'user'

export const isRelationshipField = (
  field: Fields[number]
): field is Fields[number] & { type: 'relationship'; relatedTable: string } =>
  field.type === 'relationship' && 'relatedTable' in field && typeof field.relatedTable === 'string'

export const relationshipFieldCreatesForeignKey = (field: Fields[number]): boolean =>
  !('relationType' in field) ||
  (field.relationType !== 'one-to-many' && field.relationType !== 'many-to-many')

export const isAutoTimestampField = (field: Fields[number]): boolean =>
  field.type === 'created-at' || field.type === 'updated-at'

export const shouldUseSerial = (field: Fields[number], isPrimaryKey: boolean): boolean =>
  field.type === 'autonumber' || (field.type === 'integer' && isPrimaryKey)

export const isFieldNotNull = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): boolean => {
  if (isAutoTimestampField(field)) return true
  if (isAutoPopulatedUserField(field)) return hasAuthConfig
  if (isPrimaryKey) return true
  return 'required' in field && field.required === true
}
