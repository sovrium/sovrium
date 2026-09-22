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

const validateNumericAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!isNumericFieldType(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - numeric field required`
  }
  return undefined
}

/**
 * Field types `MIN` / `MAX` may be rolled up over.
 *
 * AN ALLOW-LIST, DERIVED FROM MEASUREMENT, and deliberately not the complement
 * of the types known to fail. `MIN` was booted through the real generated DDL
 * for sixteen field types on both engines; a type absent from this list is
 * refused rather than assumed orderable, so a field type added later cannot
 * silently reach an aggregate that has no operator for it.
 *
 * The rule this replaced demanded a numeric or `date` field. Both engines order
 * TEXT natively, so "the alphabetically first assignee" was refused despite
 * working — and the old date check matched the literal `date` only, so the
 * earliest TIMESTAMP was refused too. Loosening cannot break a working config:
 * everything accepted before is still accepted.
 *
 * WHAT IS DELIBERATELY ABSENT, and why it is not an oversight:
 *
 *   - `checkbox` / `boolean`, `json` and the JSONB-backed types, `geolocation`.
 *     PostgreSQL has no aggregate for them at all — `min(boolean)`,
 *     `min(jsonb)` and `min(point)` "does not exist", and MAX mirrors MIN
 *     exactly. SQLite would boot all three, because every value there is text
 *     or a number. Accepting them would therefore not be a loosening; it would
 *     be a config that starts on the default engine and aborts schema init on
 *     PostgreSQL.
 *   - `multi-select` and other multi-value types. These are the subtle ones:
 *     they DO order on both engines, so a boot-only probe says yes. But the
 *     value returns as a native array on PostgreSQL and as the JSON string
 *     `'["a","b"]'` on SQLite (measured) — same ordering, different shape. That
 *     is the read-path divergence `ARRAYUNIQUE` had to be fixed to avoid, and
 *     admitting it here would reintroduce it.
 *
 * Numeric types are listed here rather than delegated to
 * {@link isNumericFieldType}: that predicate also gates `SUM` / `AVG`, and
 * widening it to cover everything MIN/MAX can order would silently loosen two
 * aggregations that were never measured.
 */
const ORDERABLE_FIELD_TYPES: ReadonlySet<string> = new Set([
  // Text-backed (VARCHAR / TEXT) — both engines order these natively.
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
  'rich-text',
  'single-select',
  'status',
  'color',
  'barcode',
  'single-attachment',
  'code',
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
  'lookup',
  'rollup',
  'formula',
  'button',
  'ai-categorize',
  'ai-generate',
  'ai-summary',
  'ai-translate',
  // Numeric-backed (INTEGER / DECIMAL / INTERVAL).
  'integer',
  'autonumber',
  'decimal',
  'number',
  'currency',
  'percentage',
  'duration',
  'rating',
  'progress',
  'count',
  'relationship',
  // Temporal (DATE / TIMESTAMPTZ / TIME).
  'date',
  'datetime',
  'time',
  'created-at',
  'updated-at',
  'deleted-at',
])

const validateMinMaxAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!ORDERABLE_FIELD_TYPES.has(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - a text, numeric or date/time field is required (boolean, JSON, geolocation and multi-value fields have no ordering both database engines agree on)`
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
