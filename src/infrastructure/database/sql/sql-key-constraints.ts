/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { qualifiedAuthTable } from './dialect-ddl'
import {
  isRelationshipField,
  isUserField,
  relationshipFieldCreatesForeignKey,
  shouldUseSerial,
} from './sql-field-predicates'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Whether a field gets a plain btree `UNIQUE` table constraint.
 *
 * Geolocation is excluded: Postgres `POINT` has no default btree operator class,
 * so `UNIQUE (loc)` is rejected outright. Uniqueness for those fields is
 * expressed as a UNIQUE **GiST** index by `generateIndexStatements` instead.
 *
 * **Exported because the constraint-SYNC path must apply the identical rule.**
 * Sync runs on every boot for an existing table, so a path that re-derived the
 * unique-field list without this exclusion would try to ADD the btree constraint
 * that CREATE deliberately skipped — turning a legal `geolocation` + `unique`
 * field into a schema-init failure on the SECOND boot, while the first succeeded.
 */
export const isBtreeUniqueField = (
  field: Fields[number]
): field is Fields[number] & { unique: true } =>
  'unique' in field && !!field.unique && field.type !== 'geolocation'

/**
 * Generate UNIQUE constraints for fields with unique property
 * Uses PostgreSQL default naming convention: {table}_{column}_key
 *
 * Geolocation fields are excluded — see {@link isBtreeUniqueField}.
 */
export const generateUniqueConstraints = (
  tableName: string,
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(isBtreeUniqueField)
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
 * Referential action carried by the foreign key generated for a `type: 'user'`
 * field.
 *
 * Every hand-written foreign key to the Better Auth user table names an action —
 * `CASCADE` where the row IS the user's content (sessions, comments) or
 * `SET NULL` where the row merely NAMES them (`audit_log.actor_id`,
 * `automation_runs.triggered_by_user_id`, `connections.created_by_id`). The
 * generated user-field key named none, so it defaulted to `NO ACTION`, and that
 * default is not a neutral choice: it makes an assigned account **unerasable**.
 * If any record assigns the user and was authored by somebody else, that record
 * outlives the `created_by = userId` sweep, and the closing
 * `DELETE FROM auth.user` raises a foreign-key violation that rolls back the
 * WHOLE GDPR Art. 17 purge transaction — the account can never be erased for as
 * long as the assignment exists.
 *
 * `SET NULL` is the correct member of that family: an assignment is a statement
 * ABOUT a person, not a piece of their personal data, so erasure sheds the
 * identifier and the record survives without it. `CASCADE` would silently delete
 * another author's record — over-deletion in the name of erasure.
 *
 * Applied identically on both dialects (inline in `CREATE TABLE` on SQLite,
 * inline plus `ALTER TABLE … ADD CONSTRAINT` via the boot-time constraint sync
 * on PostgreSQL) because this single string is the only emitter of that key.
 */
const USER_FIELD_ON_DELETE = ' ON DELETE SET NULL'

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
  // References the Better Auth user table — `auth.user` on PostgreSQL (the
  // table lives in the dedicated `auth` schema), `auth_user` on SQLite (no
  // schemas; the namespace is a flat table-name prefix). Centralized in
  // `qualifiedAuthTable()` so the FK string output is per-dialect correct.
  //
  // `ON DELETE SET NULL` is deliberate and load-bearing (see
  // {@link USER_FIELD_ON_DELETE}): an assignment names a PERSON, it is not that
  // person's content, so shedding the identifier and keeping the record is the
  // right outcome — and it is what keeps an assigned account erasable at all.
  const userFieldConstraints = fields.filter(isUserField).map((field) => {
    const constraintName = `${tableName}_${field.name}_fkey`
    return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES ${qualifiedAuthTable('user')}(id)${USER_FIELD_ON_DELETE}`
  })

  // Generate foreign keys for relationship fields (type: 'relationship')
  // Exclude one-to-many and many-to-many relationships as they don't create FK constraints on the parent side
  const relationshipFieldConstraints = fields
    .filter(isRelationshipField)
    // Only many-to-one relationships create a FK on the owning table; exclude
    // one-to-many (FK in related table) and many-to-many (junction table).
    .filter(relationshipFieldCreatesForeignKey)
    .map((field) => generateRelationshipConstraint(tableName, field, tableUsesView))

  // Foreign keys disabled for created-by/updated-by fields
  // Blocked by: [internal ref]
  // Infrastructure ready - uncomment lines below when issue is resolved.
  // When unblocked, the FK string MUST go through `qualifiedAuthTable('user')`
  // so the SQLite path stays correct (no `auth.` schema reference).
  const userReferenceConstraints: readonly string[] = []
  // const userReferenceConstraints = fields
  //   .filter(isUserReferenceField)
  //   .map((field) => {
  //     const constraintName = `${tableName}_${field.name}_fkey`
  //     return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES ${qualifiedAuthTable('user')}(id)`
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
