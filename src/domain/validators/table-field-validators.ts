/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared table field type for validation parameters.
 */
type TableWithFields = {
  readonly name: string
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
  }>
}

/**
 * Validation error result.
 */
type ValidationError = {
  readonly table: string
  readonly field: string
  readonly error: string
}

/**
 * Validate that a relationship field reference is valid.
 *
 * This helper validates that:
 * 1. The relationshipField exists in the current table
 * 2. The relationshipField is a relationship type
 * 3. The relatedField exists in the related table (if applicable)
 *
 * Used by both lookup and rollup field validation.
 *
 * @param params - Validation parameters
 * @returns Error object if validation fails, undefined if valid
 */
export const validateRelationshipFieldReference = (params: {
  readonly table: TableWithFields
  readonly fieldName: string
  readonly relationshipField: string
  readonly relatedField: string | undefined
  readonly tablesByName: ReadonlyMap<string, TableWithFields>
}): ValidationError | undefined => {
  const { table, fieldName, relationshipField, relatedField, tablesByName } = params

  // Check if relationshipField exists in the same table
  const fieldInSameTable = table.fields.find((f) => f.name === relationshipField)
  if (!fieldInSameTable) {
    return {
      table: table.name,
      field: fieldName,
      error: `relationshipField "${relationshipField}" not found`,
    }
  }

  // Relationship field must be a relationship type
  if (fieldInSameTable.type !== 'relationship') {
    return {
      table: table.name,
      field: fieldName,
      error: `relationshipField "${relationshipField}" must reference a relationship field`,
    }
  }

  // Validate relatedField if provided
  if (relatedField !== undefined) {
    const relatedTableName = (fieldInSameTable as { relatedTable?: string }).relatedTable
    if (relatedTableName) {
      const relatedTable = tablesByName.get(relatedTableName)
      if (relatedTable) {
        // Check if relatedField exists in the related table
        // Note: 'id' is always allowed as it's auto-generated (SERIAL primary key)
        const relatedFieldExists =
          relatedField === 'id' || relatedTable.fields.some((f) => f.name === relatedField)
        if (!relatedFieldExists) {
          return {
            table: table.name,
            field: fieldName,
            error: `relatedField "${relatedField}" not found in related table "${relatedTableName}"`,
          }
        }
      }
    }
  }

  return undefined
}

/**
 * Find the related field type for a rollup aggregation.
 */
const findRelatedFieldType = (params: {
  readonly table: TableWithFields
  readonly relationshipField: string
  readonly relatedField: string
  readonly tablesByName: ReadonlyMap<string, TableWithFields>
}): string | undefined => {
  const { table, relationshipField, relatedField, tablesByName } = params

  const relationshipFieldObj = table.fields.find((f) => f.name === relationshipField)
  if (!relationshipFieldObj || relationshipFieldObj.type !== 'relationship') {
    return undefined
  }

  const relatedTableName = (relationshipFieldObj as { relatedTable?: string }).relatedTable
  if (!relatedTableName) return undefined

  const relatedTable = tablesByName.get(relatedTableName)
  if (!relatedTable) return undefined

  // Note: 'id' is always allowed as it's auto-generated (SERIAL primary key - integer type)
  const relatedFieldObj =
    relatedField === 'id'
      ? { name: 'id', type: 'integer' }
      : relatedTable.fields.find((f) => f.name === relatedField)

  return relatedFieldObj?.type
}

const isNumericFieldType = (fieldType: string): boolean => {
  const numericTypes = ['integer', 'decimal', 'currency', 'percentage', 'duration']
  return numericTypes.includes(fieldType)
}

const isDateFieldType = (fieldType: string): boolean => {
  return fieldType === 'date'
}

const validateNumericAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!isNumericFieldType(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - numeric field required`
  }
  return undefined
}

const validateMinMaxAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!isNumericFieldType(fieldType) && !isDateFieldType(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - numeric or date field required`
  }
  return undefined
}

/**
 * Check if aggregation function is compatible with field type.
 */
const checkAggregationCompatibility = (
  aggregation: string,
  fieldType: string
): string | undefined => {
  const aggregationLower = aggregation.toLowerCase()

  switch (aggregationLower) {
    case 'sum':
    case 'avg':
      return validateNumericAggregation(aggregation, fieldType)
    case 'min':
    case 'max':
      return validateMinMaxAggregation(aggregation, fieldType)
    case 'count':
    case 'counta':
    case 'countall':
      return undefined
  }

  return undefined
}

/**
 * Validate that a rollup aggregation function is compatible with the related field type.
 */
const validateRollupAggregation = (params: {
  readonly table: TableWithFields
  readonly fieldName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly aggregation: string
  readonly tablesByName: ReadonlyMap<string, TableWithFields>
}): ValidationError | undefined => {
  const { table, fieldName, relationshipField, relatedField, aggregation, tablesByName } = params

  const relatedFieldType = findRelatedFieldType({
    table,
    relationshipField,
    relatedField,
    tablesByName,
  })

  if (!relatedFieldType) return undefined

  const error = checkAggregationCompatibility(aggregation, relatedFieldType)
  if (error) {
    return { table: table.name, field: fieldName, error }
  }

  return undefined
}

/**
 * Validate all rollup fields across all tables.
 */
export const validateAllRollupFields = (
  tables: ReadonlyArray<TableWithFields>,
  tablesByName: ReadonlyMap<string, TableWithFields>
): ValidationError | undefined => {
  return tables
    .flatMap((table) =>
      table.fields
        .filter((field) => field.type === 'rollup')
        .map((rollupField) => {
          const { relationshipField, relatedField, aggregation } = rollupField as unknown as {
            relationshipField: string
            relatedField: string
            aggregation: string
          }

          const relationshipError = validateRelationshipFieldReference({
            table,
            fieldName: rollupField.name,
            relationshipField,
            relatedField,
            tablesByName,
          })

          if (relationshipError) return relationshipError

          return validateRollupAggregation({
            table,
            fieldName: rollupField.name,
            relationshipField,
            relatedField,
            aggregation,
            tablesByName,
          })
        })
        .filter((error) => error !== undefined)
    )
    .at(0)
}
