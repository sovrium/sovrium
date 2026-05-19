/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
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

export const TablesSchema = Schema.Array(TableSchema).pipe(
  Schema.annotations({
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
    const circularPermissions = detectCircularPermissionInheritance(tables)
    if (circularPermissions.length > 0) {
      return `Circular permission inheritance detected: ${circularPermissions.join(' -> ')} - inheritance cycle not allowed`
    }
    return true
  }),
  Schema.filter((tables) => {
    const tableNames = new Set(tables.map((table) => table.name))
    const invalidInheritance = tables
      .filter((table) => table.permissions?.inherit !== undefined)
      .find((table) => !tableNames.has(table.permissions!.inherit!))

    if (invalidInheritance) {
      return `Table "${invalidInheritance.name}" inherits from table "${invalidInheritance.permissions!.inherit}" which does not exist`
    }
    return true
  }),
  Schema.filter((tables) => {
    const tablesByName = new Map(tables.map((table) => [table.name, table]))

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

    const invalidLookup = tables
      .flatMap((table) =>
        table.fields
          .filter((field) => field.type === 'lookup')
          .map((lookupField) => {
            const { relationshipField, relatedField } = lookupField as {
              relationshipField: string
              relatedField: string
            }

            const fieldInSameTable = table.fields.find((f) => f.name === relationshipField)
            if (fieldInSameTable) {
              return validateRelationshipFieldReference({
                table,
                fieldName: lookupField.name,
                relationshipField,
                relatedField,
                tablesByName,
              })
            }

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

    const invalidRollup = validateAllRollupFields(tables, tablesByName)

    if (invalidRollup) {
      return `Rollup field "${invalidRollup.table}.${invalidRollup.field}" ${invalidRollup.error}`
    }

    return true
  })
)

export type Tables = Schema.Schema.Type<typeof TablesSchema>

export { TableSchema } from './table'
export type { Table } from './table'
export { CommentsConfigSchema } from './comments'
export type { CommentsConfig } from './comments'
