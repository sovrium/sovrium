/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableSchema } from '@/domain/models/app/table'
import { detectCycles } from '@/domain/models/app/table/cycle-detection'

/**
 * Auto-generate table IDs for tables that don't have one
 *
 * Tables without explicit IDs get auto-generated numeric IDs.
 * IDs are assigned sequentially starting from the highest existing ID + 1.
 */
const autoGenerateTableIds = (
  tables: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> => {
  // Find the highest existing numeric ID
  const maxId = tables.reduce((max, table) => {
    if (table.id !== undefined && typeof table.id === 'number') {
      return Math.max(max, table.id)
    }
    return max
  }, 0)

  // Assign IDs to tables without one using reduce (functional pattern)
  const { tablesWithIds } = tables.reduce<{
    tablesWithIds: ReadonlyArray<Record<string, unknown>>
    nextId: number
  }>(
    (acc, table) => {
      if (table.id === undefined) {
        return {
          tablesWithIds: [...acc.tablesWithIds, { ...table, id: acc.nextId }],
          nextId: acc.nextId + 1,
        }
      }
      return {
        ...acc,
        tablesWithIds: [...acc.tablesWithIds, table],
      }
    },
    { tablesWithIds: [], nextId: maxId + 1 }
  )

  return tablesWithIds
}

/**
 * Detect circular relationship dependencies between tables.
 * A circular dependency exists when Table A references Table B, and Table B references Table A
 * (directly or through a chain of other tables).
 *
 * Self-referencing relationships (e.g., employees.manager → employees) are NOT considered circular
 * dependencies because they don't prevent table creation order determination.
 *
 * Bidirectional relationships (one-to-many in one direction, many-to-one in the reverse) are also
 * NOT circular dependencies because the foreign key is always on the "many" side, allowing proper
 * table creation order (create "one" side first, then "many" side with FK).
 *
 * Circular dependencies are ALLOWED when at least one side allows NULL (required: false).
 * This enables the INSERT-UPDATE pattern:
 * 1. INSERT with NULL foreign key
 * 2. INSERT second table with reference to first
 * 3. UPDATE first table to complete the circular reference
 * PostgreSQL validates constraints at statement end, making this pattern valid.
 *
 * @param tables - Array of tables to validate
 * @returns Array of table names involved in circular dependencies, or empty array if none found
 */
const detectCircularRelationships = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
      readonly relationType?: string
      readonly required?: boolean
    }>
  }>
): ReadonlyArray<string> => {
  // Build dependency graph: table name -> tables it references via REQUIRED many-to-one relationships
  // We only track REQUIRED (NOT NULL) relationships because those prevent INSERT-UPDATE pattern
  // Optional (NULL-able) relationships can be created later via UPDATE after both tables exist
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const relatedTables = table.fields
        .filter(
          (field) =>
            field.type === 'relationship' &&
            field.relatedTable !== undefined &&
            field.relatedTable !== table.name && // Exclude self-references
            (field.relationType === 'many-to-one' || field.relationType === undefined) && // Only track dependencies from FK side
            field.required !== false // Track required relationships (undefined = required by default, only false = optional)
        )
        .map((field) => field.relatedTable as string)
      return [table.name, relatedTables] as const
    })
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
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
const validateRelationshipFieldReference = (params: {
  readonly table: {
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
    }>
  }
  readonly fieldName: string
  readonly relationshipField: string
  readonly relatedField: string | undefined
  readonly tablesByName: ReadonlyMap<
    string,
    {
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
      }>
    }
  >
}):
  | {
      readonly table: string
      readonly field: string
      readonly error: string
    }
  | undefined => {
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
 *
 * @param params - Lookup parameters
 * @returns The related field type, or undefined if not found
 */
const findRelatedFieldType = (params: {
  readonly table: {
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
    }>
  }
  readonly relationshipField: string
  readonly relatedField: string
  readonly tablesByName: ReadonlyMap<
    string,
    {
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
      }>
    }
  >
}): string | undefined => {
  const { table, relationshipField, relatedField, tablesByName } = params

  // Find the relationship field to get the related table name
  const relationshipFieldObj = table.fields.find((f) => f.name === relationshipField)
  if (!relationshipFieldObj || relationshipFieldObj.type !== 'relationship') {
    return undefined
  }

  const relatedTableName = (relationshipFieldObj as { relatedTable?: string }).relatedTable
  if (!relatedTableName) {
    return undefined
  }

  const relatedTable = tablesByName.get(relatedTableName)
  if (!relatedTable) {
    return undefined
  }

  // Find the related field to check its type
  // Note: 'id' is always allowed as it's auto-generated (SERIAL primary key - integer type)
  const relatedFieldObj =
    relatedField === 'id'
      ? { name: 'id', type: 'integer' }
      : relatedTable.fields.find((f) => f.name === relatedField)

  return relatedFieldObj?.type
}

/**
 * Check if field type is numeric.
 */
const isNumericFieldType = (fieldType: string): boolean => {
  const numericTypes = ['integer', 'decimal', 'currency', 'percentage', 'duration']
  return numericTypes.includes(fieldType)
}

/**
 * Check if field type is date.
 */
const isDateFieldType = (fieldType: string): boolean => {
  return fieldType === 'date'
}

/**
 * Validate sum/avg aggregation requires numeric field.
 */
const validateNumericAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!isNumericFieldType(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - numeric field required`
  }
  return undefined
}

/**
 * Validate min/max aggregation requires numeric or date field.
 */
const validateMinMaxAggregation = (aggregation: string, fieldType: string): string | undefined => {
  if (!isNumericFieldType(fieldType) && !isDateFieldType(fieldType)) {
    return `aggregation function "${aggregation}" is incompatible with field type "${fieldType}" - numeric or date field required`
  }
  return undefined
}

/**
 * Check if aggregation function is compatible with field type.
 *
 * @param aggregation - The aggregation function (sum, avg, min, max, count, counta, countall)
 * @param fieldType - The field type to check compatibility against
 * @returns Error message if incompatible, undefined if valid
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
      // Count functions work with any field type
      return undefined
  }

  return undefined
}

/**
 * Validate that a rollup aggregation function is compatible with the related field type.
 *
 * This helper validates that:
 * 1. The aggregation function is supported
 * 2. The aggregation function is compatible with the related field's type
 *
 * Aggregation compatibility:
 * - sum, avg: Only numeric fields (integer, decimal, currency, percentage, duration)
 * - min, max: Numeric and date fields
 * - count, counta, countall: Any field type
 *
 * @param params - Validation parameters
 * @returns Error object if validation fails, undefined if valid
 */
const validateRollupAggregation = (params: {
  readonly table: {
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
    }>
  }
  readonly fieldName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly aggregation: string
  readonly tablesByName: ReadonlyMap<
    string,
    {
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
      }>
    }
  >
}):
  | {
      readonly table: string
      readonly field: string
      readonly error: string
    }
  | undefined => {
  const { table, fieldName, relationshipField, relatedField, aggregation, tablesByName } = params

  const relatedFieldType = findRelatedFieldType({
    table,
    relationshipField,
    relatedField,
    tablesByName,
  })

  if (!relatedFieldType) {
    // This should already be caught by validateRelationshipFieldReference
    return undefined
  }

  const error = checkAggregationCompatibility(aggregation, relatedFieldType)
  if (error) {
    return {
      table: table.name,
      field: fieldName,
      error,
    }
  }

  return undefined
}

/**
 * Validate all rollup fields across all tables.
 *
 * @param tables - Array of tables to validate
 * @param tablesByName - Map of table names to table objects
 * @returns Error object if validation fails, undefined if valid
 */
const validateAllRollupFields = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
    }>
  }>,
  tablesByName: ReadonlyMap<
    string,
    {
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
      }>
    }
  >
):
  | {
      readonly table: string
      readonly field: string
      readonly error: string
    }
  | undefined => {
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

          // First validate the relationship reference
          const relationshipError = validateRelationshipFieldReference({
            table,
            fieldName: rollupField.name,
            relationshipField,
            relatedField,
            tablesByName,
          })

          if (relationshipError) {
            return relationshipError
          }

          // Then validate aggregation function compatibility with field type
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

/**
 * Data Tables
 *
 * Collection of database tables that define the data structure of your application.
 * Each table represents an entity (e.g., users, products, orders) with fields that
 * define the schema. Tables support relationships, indexes, constraints, and various
 * field types. Tables are the foundation of your application's data model and
 * determine what information can be stored and how it relates.
 *
 * Table IDs can be:
 * - Explicit numeric IDs (e.g., 1, 2, 3)
 * - UUID strings (e.g., '550e8400-e29b-41d4-a716-446655440000')
 * - Simple string identifiers (e.g., 'products', 'users')
 * - Auto-generated (omit the id field and it will be assigned automatically)
 *
 * @example
 * ```typescript
 * const tables = [
 *   {
 *     id: 1,
 *     name: 'users',
 *     fields: [
 *       { id: 1, name: 'email', type: 'email', required: true },
 *       { id: 2, name: 'name', type: 'text', required: true }
 *     ]
 *   }
 * ]
 * ```
 *
 * @see docs/specifications/roadmap/tables.md for full specification
 */
export const TablesSchema = Schema.Array(TableSchema).pipe(
  Schema.transform(
    Schema.Array(TableSchema.pipe(Schema.annotations({ identifier: 'TableWithRequiredId' }))),
    {
      strict: true,
      decode: (tables) =>
        autoGenerateTableIds(tables as ReadonlyArray<Record<string, unknown>>) as ReadonlyArray<
          Schema.Schema.Type<typeof TableSchema>
        >,
      encode: (tables) => tables,
    }
  ),
  Schema.filter((tables) => {
    return tables.length > 0 || 'At least one table required - empty migration not allowed'
  }),
  Schema.filter((tables) => {
    const ids = tables.map((table) => table.id)
    const uniqueIds = new Set(ids)
    return ids.length === uniqueIds.size || 'Table IDs must be unique within the schema'
  }),
  Schema.filter((tables) => {
    const names = tables.map((table) => table.name)
    const uniqueNames = new Set(names)
    return names.length === uniqueNames.size || 'Table names must be unique within the schema'
  }),
  Schema.filter((tables) => {
    const circularTables = detectCircularRelationships(tables)
    if (circularTables.length > 0) {
      return `Circular relationship dependency detected: ${circularTables.join(' -> ')} - cannot resolve table creation order`
    }
    return true
  }),
  Schema.filter((tables) => {
    // Create tablesByName map once for all field validations
    const tablesByName = new Map(tables.map((table) => [table.name, table]))

    // Validate relationship fields reference existing tables
    const invalidRelationship = tables
      .flatMap((table) =>
        table.fields
          .filter((field) => field.type === 'relationship')
          .map((relationshipField) => {
            const { relatedTable } = relationshipField as { relatedTable?: string }

            if (relatedTable && !tablesByName.has(relatedTable)) {
              return {
                table: table.name,
                field: relationshipField.name,
                relatedTable,
              }
            }

            return undefined
          })
          .filter((error) => error !== undefined)
      )
      .at(0)

    if (invalidRelationship) {
      return `Relationship field "${invalidRelationship.table}.${invalidRelationship.field}": relatedTable "${invalidRelationship.relatedTable}" does not exist`
    }

    // Validate lookup fields reference existing relationship fields (either in same table or reverse relationship)
    const invalidLookup = tables
      .flatMap((table) =>
        table.fields
          .filter((field) => field.type === 'lookup')
          .map((lookupField) => {
            const { relationshipField, relatedField } = lookupField as {
              relationshipField: string
              relatedField: string
            }

            // Check if relationshipField exists in the same table (forward lookup)
            const fieldInSameTable = table.fields.find((f) => f.name === relationshipField)
            if (fieldInSameTable) {
              // Use shared validation helper for forward lookup
              return validateRelationshipFieldReference({
                table,
                fieldName: lookupField.name,
                relationshipField,
                relatedField,
                tablesByName,
              })
            }

            // Check if relationshipField exists in other tables (reverse lookup)
            const reverseRelationship = [...tablesByName.values()]
              .flatMap((otherTable) =>
                otherTable.fields
                  .filter(
                    (field) =>
                      field.type === 'relationship' &&
                      field.name === relationshipField &&
                      (field as { relatedTable?: string }).relatedTable === table.name
                  )
                  .map(() => ({ found: true, relatedTable: otherTable }))
              )
              .at(0)

            if (!reverseRelationship) {
              return {
                table: table.name,
                field: lookupField.name,
                error: `relationshipField "${relationshipField}" not found`,
              }
            }

            // For reverse lookup, check if relatedField exists in the table that has the relationship
            if (reverseRelationship.relatedTable) {
              const relatedFieldExists = reverseRelationship.relatedTable.fields.some(
                (f) => f.name === relatedField
              )
              if (!relatedFieldExists) {
                return {
                  table: table.name,
                  field: lookupField.name,
                  error: `relatedField "${relatedField}" not found in related table "${reverseRelationship.relatedTable.name}"`,
                }
              }
            }

            return undefined
          })
          .filter((error) => error !== undefined)
      )
      .at(0)

    if (invalidLookup) {
      return `Lookup field "${invalidLookup.table}.${invalidLookup.field}" ${invalidLookup.error}`
    }

    // Validate rollup fields reference existing relationship fields and related fields
    const invalidRollup = validateAllRollupFields(tables, tablesByName)

    if (invalidRollup) {
      return `Rollup field "${invalidRollup.table}.${invalidRollup.field}" ${invalidRollup.error}`
    }

    return true
  }),
  Schema.annotations({
    title: 'Data Tables',
    description:
      'Collection of database tables that define the data structure of your application. Each table represents an entity (e.g., users, products, orders) with fields that define the schema. Tables support relationships, indexes, constraints, and various field types. Tables are the foundation of your application data model and determine what information can be stored and how it relates.',
    examples: [
      [
        {
          id: 1,
          name: 'users',
          fields: [
            { id: 1, name: 'email', type: 'email' as const, required: true },
            { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
          ],
        },
      ],
    ],
  })
)

export type Tables = Schema.Schema.Type<typeof TablesSchema>

// Re-export Table and TableSchema for convenience
export { TableSchema } from '@/domain/models/app/table'
export type { Table } from '@/domain/models/app/table'
