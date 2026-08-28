/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'
import {
  validateAllRollupFields,
  validateRelationshipFieldReference,
} from '@/domain/validators/table-field-validators'
import {
  autoGenerateTableIds,
  detectCircularPermissionInheritance,
  detectCircularRelationships,
} from '@/domain/validators/table-transforms'
import { TableSchema } from './table'

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
 * @see [internal ref] for full specification
 */
export const TablesSchema = Schema.Array(TableSchema).pipe(
  Schema.annotate({
    identifier: 'DataTables',
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
  }),
  // EFFECT 4: `Schema.transform(to, {strict, decode, encode})` is replaced by
  // `Schema.decodeTo(to, { decode, encode })` with each side wrapped in a
  // `SchemaGetter.transform` — `decodeTo` takes GETTERS, not the `Transformation`
  // that `SchemaTransformation.transform` builds; the two are not interchangeable
  // and the migration reference names only the latter.
  // (migration/v3-to-v4.md:14284). Both are data-last and the decode direction
  // is unchanged (From["Type"] -> To["Encoded"]); `strict` no longer exists.
  Schema.decodeTo(
    Schema.Array(TableSchema.pipe(Schema.annotate({ identifier: 'TableWithRequiredId' }))),
    {
      decode: SchemaGetter.transform(
        (tables) =>
          autoGenerateTableIds(tables as ReadonlyArray<Record<string, unknown>>) as ReadonlyArray<
            Schema.Schema.Type<typeof TableSchema>
          >
      ),
      // v3 spelled the identity encode `(x) => x` under `strict: true`. v4 has
      // no `strict` on the transform; the equivalent escape hatch is
      // `passthrough({ strict: false })` — the two sides differ only in whether
      // `id` is required, and the auto-generation above is precisely what makes
      // that true, so the identity is sound in both directions.
      encode: SchemaGetter.passthrough({ strict: false }),
    }
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
      const ids = tables.map((table) => table.id)
      const uniqueIds = new Set(ids)
      return ids.length === uniqueIds.size || 'Table IDs must be unique within the schema'
    })
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
      const names = tables.map((table) => table.name)
      const uniqueNames = new Set(names)
      return names.length === uniqueNames.size || 'Table names must be unique within the schema'
    })
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
      const circularTables = detectCircularRelationships(tables)
      if (circularTables.length > 0) {
        return `Circular relationship dependency detected: ${circularTables.join(' -> ')} - cannot resolve table creation order`
      }
      return true
    })
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
      const circularPermissions = detectCircularPermissionInheritance(tables)
      if (circularPermissions.length > 0) {
        return `Circular permission inheritance detected: ${circularPermissions.join(' -> ')} - inheritance cycle not allowed`
      }
      return true
    })
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
      // Validate that inherited tables exist
      const tableNames = new Set(tables.map((table) => table.name))
      const invalidInheritance = tables
        .filter((table) => table.permissions?.inherit !== undefined)
        .find((table) => !tableNames.has(table.permissions!.inherit!))

      if (invalidInheritance) {
        return `Table "${invalidInheritance.name}" inherits from table "${invalidInheritance.permissions!.inherit}" which does not exist`
      }
      return true
    })
  ),
  Schema.check(
    Schema.makeFilter((tables) => {
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
    })
  )
)

export type Tables = Schema.Schema.Type<typeof TablesSchema>

// Re-export Table and TableSchema for convenience
export { TableSchema } from './table'
export type { Table } from './table'
export { CommentsConfigSchema } from './comments'
export type { CommentsConfig } from './comments'
