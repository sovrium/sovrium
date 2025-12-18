/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  generateCountExpression,
  generateLookupExpression,
  generateRollupExpression,
} from './lookup-expression-generators'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'
import type { ViewFilterCondition } from '@/domain/models/app/table/views/filters'

/**
 * Check if a field is a lookup field
 */
const isLookupField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'lookup'
  relationshipField: string
  relatedField: string
  filters?: ViewFilterCondition
} =>
  field.type === 'lookup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string'

/**
 * Check if a field is a rollup field
 */
const isRollupField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'rollup'
  relationshipField: string
  relatedField: string
  aggregation: string
  filters?: ViewFilterCondition
} =>
  field.type === 'rollup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  'aggregation' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string' &&
  typeof field.aggregation === 'string'

/**
 * Check if a field is a count field
 */
const isCountField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'count'
  relationshipField: string
  conditions?: readonly ViewFilterCondition[]
} =>
  field.type === 'count' &&
  'relationshipField' in field &&
  typeof field.relationshipField === 'string'

/**
 * Check if a table has any lookup fields
 */
export const hasLookupFields = (table: Table): boolean =>
  table.fields.some((field) => isLookupField(field))

/**
 * Check if a table has any rollup fields
 */
export const hasRollupFields = (table: Table): boolean =>
  table.fields.some((field) => isRollupField(field))

/**
 * Check if a table has any count fields
 */
export const hasCountFields = (table: Table): boolean =>
  table.fields.some((field) => isCountField(field))

/**
 * Lookup field type
 */
type LookupField = Fields[number] & {
  readonly type: 'lookup'
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters?: ViewFilterCondition
}

/**
 * Check if lookup field is a forward lookup (many-to-one, not many-to-many)
 */
const isForwardLookup = (field: LookupField, allFields: readonly Fields[number][]): boolean => {
  const relationshipFieldDef = allFields.find((f) => f.name === field.relationshipField)
  return !!(
    relationshipFieldDef?.type === 'relationship' &&
    'relatedTable' in relationshipFieldDef &&
    'relationType' in relationshipFieldDef &&
    relationshipFieldDef.relationType !== 'many-to-many'
  )
}

/**
 * Generate JOIN clause for a forward lookup field
 */
const generateJoinClause = (field: LookupField, allFields: readonly Fields[number][]): string => {
  const relationshipFieldDef = allFields.find((f) => f.name === field.relationshipField)
  if (!relationshipFieldDef?.type || relationshipFieldDef.type !== 'relationship') return ''
  const { relatedTable } = relationshipFieldDef as { relatedTable: string }
  const alias = `${relatedTable}_for_${field.name}`
  return `LEFT JOIN ${relatedTable} AS ${alias} ON ${alias}.id = base.${field.relationshipField}`
}

/**
 * Generate CREATE VIEW statement for a table with lookup, rollup, and/or count fields
 * Returns empty string if table has no lookup, rollup, or count fields
 */
export const generateLookupViewSQL = (table: Table): string => {
  const lookupFields = table.fields.filter(isLookupField)
  const rollupFields = table.fields.filter(isRollupField)
  const countFields = table.fields.filter(isCountField)

  if (lookupFields.length === 0 && rollupFields.length === 0 && countFields.length === 0) {
    return ''
  }

  // Generate expressions for computed columns
  const lookupExpressions = lookupFields.map((f) =>
    generateLookupExpression(f, 'base', table.fields, table.name)
  )
  const rollupExpressions = rollupFields.map((f) =>
    generateRollupExpression(f, 'base', table.fields)
  )
  const countExpressions = countFields.map((f) => generateCountExpression(f, 'base', table.fields))

  // Build JOIN clauses for forward lookups (many-to-one only)
  const joins = lookupFields
    .filter((f) => isForwardLookup(f, table.fields))
    .map((f) => generateJoinClause(f, table.fields))
    .filter((j) => j !== '')
    .join('\n  ')

  // Assemble the final VIEW SQL
  const selectClause = [
    'base.*',
    ...lookupExpressions,
    ...rollupExpressions,
    ...countExpressions,
  ].join(',\n    ')

  return `CREATE OR REPLACE VIEW ${table.name} AS
  SELECT
    ${selectClause}
  FROM ${table.name}_base AS base
  ${joins ? joins : ''}`
}

/**
 * Generate base table name for a table with lookup fields
 * The actual table is named {table}_base, and the VIEW is named {table}
 */
export const getBaseTableName = (tableName: string): string => `${tableName}_base`

/**
 * Check if a table should use a VIEW (has lookup, rollup, or count fields)
 */
export const shouldUseView = (table: Table): boolean =>
  hasLookupFields(table) || hasRollupFields(table) || hasCountFields(table)

/**
 * Get base fields (non-lookup, non-rollup, non-count, non-one-to-many, non-many-to-many, non-id fields)
 */
const getBaseFields = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => {
      // Exclude lookup, rollup, and count fields (handled by VIEW)
      if (field.type === 'lookup' || field.type === 'rollup' || field.type === 'count') {
        return false
      }
      // Exclude one-to-many and many-to-many relationship fields (don't create columns)
      if (
        field.type === 'relationship' &&
        'relationType' in field &&
        (field.relationType === 'one-to-many' || field.relationType === 'many-to-many')
      ) {
        return false
      }
      // Exclude id field (auto-generated)
      if (field.name === 'id') {
        return false
      }
      return true
    })
    .map((field) => field.name)

/**
 * Generate INSTEAD OF INSERT trigger for a VIEW
 */
const generateInsertTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const insertTriggerFunction = `${viewName}_instead_of_insert`
  const insertTrigger = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = baseFields.map((name) => `NEW.${name}`).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${insertTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ${baseTableName} (${insertFieldsList})
  VALUES (${insertValuesList});
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${insertTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${insertTrigger}
INSTEAD OF INSERT ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${insertTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF UPDATE trigger for a VIEW
 */
const generateUpdateTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const updateTriggerFunction = `${viewName}_instead_of_update`
  const updateTrigger = `${viewName}_update_trigger`
  const updateSetList = baseFields.map((name) => `${name} = NEW.${name}`).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${updateTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ${baseTableName}
  SET ${updateSetList}
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${updateTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${updateTrigger}
INSTEAD OF UPDATE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${updateTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF DELETE trigger for a VIEW
 */
const generateDeleteTrigger = (viewName: string, baseTableName: string): readonly string[] => {
  const deleteTriggerFunction = `${viewName}_instead_of_delete`
  const deleteTrigger = `${viewName}_delete_trigger`

  return [
    `CREATE OR REPLACE FUNCTION ${deleteTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ${baseTableName}
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${deleteTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${deleteTrigger}
INSTEAD OF DELETE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${deleteTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF triggers for a VIEW to make it writable
 * These triggers redirect INSERT/UPDATE/DELETE operations to the base table
 */
export const generateLookupViewTriggers = (table: Table): readonly string[] => {
  if (!shouldUseView(table)) {
    return [] // No VIEW, no triggers needed
  }

  const baseTableName = getBaseTableName(table.name)
  const viewName = table.name
  const baseFields = getBaseFields(table)

  return [
    ...generateInsertTrigger(viewName, baseTableName, baseFields),
    ...generateUpdateTrigger(viewName, baseTableName, baseFields),
    ...generateDeleteTrigger(viewName, baseTableName),
  ]
}
