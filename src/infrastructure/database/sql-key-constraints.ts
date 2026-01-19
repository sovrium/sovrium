/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRelationshipField, isUserField, shouldUseSerial } from './sql-field-predicates'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Generate UNIQUE constraints for fields with unique property
 * Uses PostgreSQL default naming convention: {table}_{column}_key
 *
 * NOTE: Geolocation fields are excluded because POINT type requires GiST index for UNIQUE,
 * not btree. UNIQUE GiST indexes for geolocation fields are created separately in
 * generateIndexStatements() in schema-initializer.ts
 */
export const generateUniqueConstraints = (
  tableName: string,
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { unique: true } =>
        'unique' in field && !!field.unique && field.type !== 'geolocation'
    )
    .map((field) => `CONSTRAINT ${tableName}_${field.name}_key UNIQUE (${field.name})`)

/**
 * Map onDelete/onUpdate values to PostgreSQL referential actions
 *
 * @param action - The referential action (cascade, set-null, restrict, etc.)
 * @param clauseType - The type of clause (delete or update)
 * @returns PostgreSQL referential action clause (e.g., " ON DELETE CASCADE")
 */
const mapReferentialAction = (
  action: string | undefined,
  clauseType: 'delete' | 'update'
): string => {
  if (!action) return ''
  const upperAction = action.toUpperCase()
  const validActions = ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION']

  // Map 'set-null' to 'SET NULL' for PostgreSQL compatibility
  const normalizedAction = upperAction === 'SET-NULL' ? 'SET NULL' : upperAction

  // Find matching PostgreSQL action
  const postgresAction = validActions.find(
    (valid) => valid.replace(' ', '-') === normalizedAction || valid === normalizedAction
  )

  if (!postgresAction) return ''

  const clausePrefix = clauseType === 'delete' ? 'ON DELETE' : 'ON UPDATE'
  return ` ${clausePrefix} ${postgresAction}`
}

/**
 * Generate composite foreign key constraints from table.foreignKeys array
 */
const generateCompositeForeignKeyConstraints = (
  compositeForeignKeys: readonly {
    readonly name: string
    readonly fields: readonly string[]
    readonly referencedTable: string
    readonly referencedFields: readonly string[]
    readonly onDelete?: string
    readonly onUpdate?: string
  }[]
): readonly string[] =>
  compositeForeignKeys.map((fk) => {
    const localFields = fk.fields.join(', ')
    const referencedFields = fk.referencedFields.join(', ')
    const onDeleteClause = mapReferentialAction(fk.onDelete, 'delete')
    const onUpdateClause = mapReferentialAction(fk.onUpdate, 'update')

    return `CONSTRAINT ${fk.name} FOREIGN KEY (${localFields}) REFERENCES ${fk.referencedTable}(${referencedFields})${onDeleteClause}${onUpdateClause}`
  })

/**
 * Generate FOREIGN KEY constraint for relationship field
 */
const generateRelationshipConstraint = (
  tableName: string,
  field: Fields[number] & { readonly type: 'relationship'; readonly relatedTable: string },
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  const constraintName = `${tableName}_${field.name}_fkey`
  // If the related table uses a VIEW (has lookup fields), reference the base table instead
  const relatedTableName =
    tableUsesView?.get(field.relatedTable) === true
      ? `${field.relatedTable}_base`
      : field.relatedTable

  // Build referential actions (ON DELETE, ON UPDATE)
  const onDeleteClause =
    'onDelete' in field ? mapReferentialAction(field.onDelete as string | undefined, 'delete') : ''
  const onUpdateClause =
    'onUpdate' in field ? mapReferentialAction(field.onUpdate as string | undefined, 'update') : ''

  // Use relatedField if specified, otherwise default to 'id'
  const referencedColumn = 'relatedField' in field && field.relatedField ? field.relatedField : 'id'

  return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES ${relatedTableName}(${referencedColumn})${onDeleteClause}${onUpdateClause}`
}

/**
 * Generate FOREIGN KEY constraints for user fields, relationship fields, and composite foreign keys
 * Exported for use in migration system to sync FK constraints
 */
export const generateForeignKeyConstraints = (
  tableName: string,
  fields: readonly Fields[number][],
  tableUsesView?: ReadonlyMap<string, boolean>,
  compositeForeignKeys?: readonly {
    readonly name: string
    readonly fields: readonly string[]
    readonly referencedTable: string
    readonly referencedFields: readonly string[]
    readonly onDelete?: string
    readonly onUpdate?: string
  }[]
): readonly string[] => {
  // Generate foreign keys for user fields (type: 'user')
  // References auth.user table (Better Auth users in dedicated auth schema)
  const userFieldConstraints = fields.filter(isUserField).map((field) => {
    const constraintName = `${tableName}_${field.name}_fkey`
    return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES auth.user(id)`
  })

  // Generate foreign keys for relationship fields (type: 'relationship')
  // Exclude one-to-many and many-to-many relationships as they don't create FK constraints on the parent side
  const relationshipFieldConstraints = fields
    .filter(isRelationshipField)
    .filter((field) => {
      // Only create FK for many-to-one relationships or relationships without explicit relationType
      // Exclude one-to-many (FK in related table) and many-to-many (uses junction table)
      return (
        !('relationType' in field) ||
        (field.relationType !== 'one-to-many' && field.relationType !== 'many-to-many')
      )
    })
    .map((field) => generateRelationshipConstraint(tableName, field, tableUsesView))

  // Foreign keys disabled for created-by/updated-by fields
  // Blocked by: https://github.com/sovrium/sovrium/issues/3980
  // Infrastructure ready - uncomment lines below when issue is resolved
  const userReferenceConstraints: readonly string[] = []
  // const userReferenceConstraints = fields
  //   .filter(isUserReferenceField)
  //   .map((field) => {
  //     const constraintName = `${tableName}_${field.name}_fkey`
  //     return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES auth.user(id)`
  //   })

  // Generate composite foreign key constraints
  const compositeFKs = generateCompositeForeignKeyConstraints(compositeForeignKeys ?? [])

  return [
    ...userFieldConstraints,
    ...relationshipFieldConstraints,
    ...userReferenceConstraints,
    ...compositeFKs,
  ]
}

/**
 * Generate primary key constraint if defined
 * Skips single-field composite keys when the field is SERIAL (PRIMARY KEY is already inline)
 * Note: Special field 'id' is automatically SERIAL, so PRIMARY KEY is inline
 */
export const generatePrimaryKeyConstraint = (table: Table): readonly string[] => {
  if (table.primaryKey?.type === 'composite' && table.primaryKey.fields) {
    // For single-field composite keys, check if the field is SERIAL (PRIMARY KEY already inline)
    if (table.primaryKey.fields.length === 1) {
      const pkFieldName = table.primaryKey.fields[0]
      const pkField = table.fields.find((f) => f.name === pkFieldName)

      // Special case: 'id' field is automatically SERIAL, PRIMARY KEY is inline
      if (pkFieldName === 'id' && !pkField) {
        // PRIMARY KEY is already inline in the automatic id column definition
        return []
      }

      if (pkField && shouldUseSerial(pkField, true)) {
        // PRIMARY KEY is already inline in the SERIAL column definition
        return []
      }
    }
    return [`PRIMARY KEY (${table.primaryKey.fields.join(', ')})`]
  }
  return []
}

/**
 * Generate composite UNIQUE constraints from table.uniqueConstraints
 * These are multi-column unique constraints (e.g., UNIQUE (email, tenant_id))
 */
export const generateCompositeUniqueConstraints = (table: Table): readonly string[] => {
  if (!table.uniqueConstraints || table.uniqueConstraints.length === 0) {
    return []
  }

  return table.uniqueConstraints.map((constraint) => {
    const fields = constraint.fields.join(', ')
    return `CONSTRAINT ${constraint.name} UNIQUE (${fields})`
  })
}
