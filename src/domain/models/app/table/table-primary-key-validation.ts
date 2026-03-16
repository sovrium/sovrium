/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from './field-types/validation-utils'
import { SPECIAL_FIELDS } from './table-formula-validation'

/**
 * Validate primary key configuration (field references, duplicates).
 *
 * @param primaryKey - Primary key configuration to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
export const validatePrimaryKey = (
  primaryKey: { readonly type: string; readonly fields?: ReadonlyArray<string> } | undefined,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  if (!primaryKey || primaryKey.type !== 'composite' || !primaryKey.fields) {
    return undefined
  }

  // Check for duplicate field references
  const duplicateField = findDuplicate(primaryKey.fields)

  if (duplicateField) {
    return {
      message: `Primary key field '${duplicateField}' is not unique - duplicate field references in composite primary key`,
      path: ['primaryKey', 'fields'],
    }
  }

  // Check for non-existent field references (allow special fields)
  const invalidField = primaryKey.fields.find(
    (field) => !fieldNames.has(field) && !SPECIAL_FIELDS.has(field)
  )

  if (invalidField) {
    return {
      message: `Primary key references non-existent field '${invalidField}' - field not found in table`,
      path: ['primaryKey', 'fields'],
    }
  }

  return undefined
}
