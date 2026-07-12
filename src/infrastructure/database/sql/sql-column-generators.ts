/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  castFormulaDivisionOperands,
  isFormulaVolatile,
  getFormulaFieldsNeedingTrigger,
  isFormulaReturningArray,
  isViewComputedFormula,
  translateFormulaToPostgres,
} from '../formula/formula-utils'
import { resolvePrimaryKeyColumnType } from '../table-operations/column-generators'
import { SQLITE_ISO_NOW } from './dialect-ddl'
import { isAutoTimestampField, isFieldNotNull, shouldUseSerial } from './sql-field-predicates'
import { mapFieldTypeToDialect, mapFormulaResultTypeToDialect } from './sql-type-mappings'
import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/tables/fields'

const formatDefaultValue = (defaultValue: unknown): string => {
  if (typeof defaultValue === 'boolean') {
    return String(defaultValue)
  }
  if (typeof defaultValue === 'number') {
    return String(defaultValue)
  }
  return `'${escapeSqlString(String(defaultValue))}'`
}

const generateSerialColumn = (fieldName: string, isPrimaryKey: boolean = false): string => {
  if (isSqliteRuntime()) {
    return isPrimaryKey
      ? `${fieldName} INTEGER PRIMARY KEY AUTOINCREMENT`
      : `${fieldName} INTEGER NOT NULL`
  }
  return isPrimaryKey ? `${fieldName} SERIAL PRIMARY KEY` : `${fieldName} SERIAL NOT NULL`
}

const generateNotNullConstraint = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): string => {
  return isFieldNotNull(field, isPrimaryKey, hasAuthConfig) ? ' NOT NULL' : ''
}

const formatArrayDefault = (defaultValue: readonly unknown[]): string => {
  if (isSqliteRuntime()) {
    return ` DEFAULT '${escapeSqlString(JSON.stringify(defaultValue))}'`
  }
  const arrayValues = defaultValue.map((val) => `'${escapeSqlString(String(val))}'`).join(', ')
  return ` DEFAULT ARRAY[${arrayValues}]`
}

const formatSpecialDefault = (field: Fields[number], defaultValue: unknown): string | undefined => {
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'CURRENT_DATE') {
    return ' DEFAULT CURRENT_DATE'
  }
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'NOW()') {
    return isSqliteRuntime() ? ` DEFAULT (${SQLITE_ISO_NOW})` : ' DEFAULT NOW()'
  }
  if (field.type === 'duration' && typeof defaultValue === 'number') {
    return isSqliteRuntime()
      ? ` DEFAULT ${defaultValue}`
      : ` DEFAULT INTERVAL '${defaultValue} seconds'`
  }
  if (Array.isArray(defaultValue)) {
    return formatArrayDefault(defaultValue)
  }
  return undefined
}

const autoTimestampDefaultClause = (): string =>
  isSqliteRuntime() ? ` DEFAULT (${SQLITE_ISO_NOW})` : ' DEFAULT CURRENT_TIMESTAMP'

const generateDefaultClause = (field: Fields[number]): string => {
  if (isAutoTimestampField(field)) {
    return autoTimestampDefaultClause()
  }

  if (field.type === 'progress' && field.required === true && !('default' in field)) {
    return ' DEFAULT 0'
  }

  if (field.type === 'ai-tag') {
    return isSqliteRuntime() ? " DEFAULT '[]'" : " DEFAULT '[]'::jsonb"
  }

  if ('default' in field && field.default !== undefined) {
    const defaultValue = field.default
    const specialDefault = formatSpecialDefault(field, defaultValue)
    if (specialDefault) {
      return specialDefault
    }
    return ` DEFAULT ${formatDefaultValue(defaultValue)}`
  }

  return ''
}

export const getColumnDefaultExpression = (field: Fields[number]): string | undefined => {
  const clause = generateDefaultClause(field)
  return clause === '' ? undefined : clause.replace(/^ DEFAULT /, '')
}

const formulaEmitsPlainColumn = (
  field: Fields[number] & { readonly type: 'formula'; readonly formula: string },
  allFields?: readonly Fields[number][]
): boolean => (allFields ? isViewComputedFormula(field, allFields) : false) || isSqliteRuntime()

const generateFormulaColumn = (
  field: Fields[number] & { readonly type: 'formula'; readonly formula: string },
  allFields?: readonly Fields[number][]
): string => {
  const baseResultType =
    'resultType' in field && field.resultType
      ? mapFormulaResultTypeToDialect(field.resultType)
      : 'TEXT'

  if (formulaEmitsPlainColumn(field, allFields)) {
    return `${field.name} ${baseResultType}`
  }

  const resultType =
    isFormulaReturningArray(field.formula) && !baseResultType.endsWith('[]')
      ? `${baseResultType}[]`
      : baseResultType

  const translatedFormula = translateFormulaToPostgres(field.formula, allFields)

  const triggerFields = allFields ? getFormulaFieldsNeedingTrigger(allFields) : new Set<string>()
  if (isFormulaVolatile(translatedFormula) || triggerFields.has(field.name)) {
    return `${field.name} ${resultType}`
  }

  const castFormula = allFields
    ? castFormulaDivisionOperands(translatedFormula, allFields)
    : translatedFormula
  return `${field.name} ${resultType} GENERATED ALWAYS AS (${castFormula}) STORED`
}

const resolveRelationshipColumnType = (
  field: Fields[number] & { readonly type: 'relationship'; readonly relatedTable: string },
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined> | undefined
): string => {
  if (tablePrimaryKeyTypes?.has(field.relatedTable)) {
    return resolvePrimaryKeyColumnType(tablePrimaryKeyTypes.get(field.relatedTable))
  }
  return mapFieldTypeToDialect(field)
}

export const generateColumnDefinition = (
  field: Fields[number],
  isPrimaryKey: boolean,
  allFields?: readonly Fields[number][],
  hasAuthConfig: boolean = true,
  tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
): string => {
  if (shouldUseSerial(field, isPrimaryKey)) {
    return generateSerialColumn(field.name, isPrimaryKey)
  }

  if (field.type === 'formula' && 'formula' in field && field.formula) {
    return generateFormulaColumn(field, allFields)
  }

  const columnType =
    field.type === 'relationship' && 'relatedTable' in field && field.relatedTable
      ? resolveRelationshipColumnType(field, tablePrimaryKeyTypes)
      : mapFieldTypeToDialect(field)
  const notNull = generateNotNullConstraint(field, isPrimaryKey, hasAuthConfig)
  const defaultValue = generateDefaultClause(field)
  return `${field.name} ${columnType}${notNull}${defaultValue}`
}
