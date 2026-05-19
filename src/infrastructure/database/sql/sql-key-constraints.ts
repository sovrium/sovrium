/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRelationshipField, isUserField, shouldUseSerial } from './sql-field-predicates'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

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

const mapReferentialAction = (
  action: string | undefined,
  clauseType: 'delete' | 'update'
): string => {
  if (!action) return ''
  const upperAction = action.toUpperCase()
  const validActions = ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION']

  const normalizedAction = upperAction === 'SET-NULL' ? 'SET NULL' : upperAction

  const postgresAction = validActions.find(
    (valid) => valid.replace(' ', '-') === normalizedAction || valid === normalizedAction
  )

  if (!postgresAction) return ''

  const clausePrefix = clauseType === 'delete' ? 'ON DELETE' : 'ON UPDATE'
  return ` ${clausePrefix} ${postgresAction}`
}

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

const generateRelationshipConstraint = (
  tableName: string,
  field: Fields[number] & { readonly type: 'relationship'; readonly relatedTable: string },
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  const constraintName = `${tableName}_${field.name}_fkey`
  const relatedTableName =
    tableUsesView?.get(field.relatedTable) === true
      ? `${field.relatedTable}_base`
      : field.relatedTable

  const onDeleteClause =
    'onDelete' in field ? mapReferentialAction(field.onDelete as string | undefined, 'delete') : ''
  const onUpdateClause =
    'onUpdate' in field ? mapReferentialAction(field.onUpdate as string | undefined, 'update') : ''

  const referencedColumn = 'relatedField' in field && field.relatedField ? field.relatedField : 'id'

  return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES ${relatedTableName}(${referencedColumn})${onDeleteClause}${onUpdateClause}`
}

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
  const userFieldConstraints = fields.filter(isUserField).map((field) => {
    const constraintName = `${tableName}_${field.name}_fkey`
    return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES auth.user(id)`
  })

  const relationshipFieldConstraints = fields
    .filter(isRelationshipField)
    .filter((field) => {
      return (
        !('relationType' in field) ||
        (field.relationType !== 'one-to-many' && field.relationType !== 'many-to-many')
      )
    })
    .map((field) => generateRelationshipConstraint(tableName, field, tableUsesView))

  const userReferenceConstraints: readonly string[] = []

  const compositeFKs = generateCompositeForeignKeyConstraints(compositeForeignKeys ?? [])

  return [
    ...userFieldConstraints,
    ...relationshipFieldConstraints,
    ...userReferenceConstraints,
    ...compositeFKs,
  ]
}

export const generatePrimaryKeyConstraint = (table: Table): readonly string[] => {
  if (table.primaryKey?.type === 'composite' && table.primaryKey.fields) {
    if (table.primaryKey.fields.length === 1) {
      const pkFieldName = table.primaryKey.fields[0]
      const pkField = table.fields.find((f) => f.name === pkFieldName)

      if (pkFieldName === 'id' && !pkField) {
        return []
      }

      if (pkField && shouldUseSerial(pkField, true)) {
        return []
      }
    }
    return [`PRIMARY KEY (${table.primaryKey.fields.join(', ')})`]
  }
  return []
}
