/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  isRelationshipField,
  isUserField,
  relationshipFieldCreatesForeignKey,
} from '../sql/sql-generators'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

const indexTableRef = (sanitized: string): string =>
  isSqliteRuntime() ? sanitized : `public.${sanitized}`

const generateStandardIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const sqlite = isSqliteRuntime()
  return table.fields
    .filter(
      (field): field is Fields[number] & { indexed: true } => 'indexed' in field && !!field.indexed
    )
    .flatMap((field) => {
      const needsGin = field.type === 'array' || field.type === 'json'
      const needsGist = field.type === 'geolocation'
      if (sqlite && (needsGin || needsGist)) return []
      const indexSuffix = field.type === 'status' ? 'status' : field.name
      const indexName = `idx_${sanitized}_${indexSuffix}`
      if (sqlite) {
        return [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${sanitized} (${field.name})`]
      }
      const indexType = needsGin ? 'USING gin' : needsGist ? 'USING gist' : 'USING btree'
      return [
        `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} ${indexType} (${field.name})`,
      ]
    })
}

const generateAutonumberIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const tableRef = indexTableRef(sanitized)
  return table.fields
    .filter((field) => field.type === 'autonumber')
    .map((field) => {
      const indexName = `idx_${sanitized}_${field.name}_unique`
      return `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableRef} (${field.name})`
    })
}

const generateGeolocationConstraints = (table: Table): readonly string[] => {
  if (isSqliteRuntime()) return []
  const sanitized = sanitizeTableName(table.name)
  return table.fields
    .filter(
      (field): field is Fields[number] & { type: 'geolocation'; unique: true } =>
        field.type === 'geolocation' && 'unique' in field && !!field.unique
    )
    .map((field) => {
      const constraintName = `${sanitized}_${field.name}_key`
      return `ALTER TABLE public.${sanitized} ADD CONSTRAINT ${constraintName} EXCLUDE USING gist (${field.name} WITH ~=)`
    })
}

const generateFullTextSearchIndexes = (table: Table): readonly string[] => {
  if (isSqliteRuntime()) return []
  const sanitized = sanitizeTableName(table.name)
  return table.fields
    .filter(
      (field): field is Fields[number] & { type: 'rich-text'; fullTextSearch: true } =>
        field.type === 'rich-text' && 'fullTextSearch' in field && !!field.fullTextSearch
    )
    .map((field) => {
      const indexName = `idx_${sanitized}_${field.name}_fulltext`
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING gin (to_tsvector('english'::regconfig, ${field.name}))`
    })
}

const generateCustomIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const tableRef = indexTableRef(sanitized)
  return (
    table.indexes?.map((index) => {
      const uniqueClause = index.unique ? 'UNIQUE ' : ''
      const fields = index.fields.join(', ')
      const whereClause = 'where' in index && index.where ? ` WHERE ${index.where}` : ''
      return `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${index.name} ON ${tableRef} (${fields})${whereClause}`
    }) ?? []
  )
}

const generateDeletedAtIndex = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const indexName = `idx_${sanitized}_deleted_at`
  return isSqliteRuntime()
    ? [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${sanitized} (deleted_at)`]
    : [`CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (deleted_at)`]
}

const generateForeignKeyIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const sqlite = isSqliteRuntime()
  const fkIndexSql = (fieldName: string): string => {
    const indexName = `idx_${sanitized}_${fieldName}_fk`
    return sqlite
      ? `CREATE INDEX IF NOT EXISTS ${indexName} ON ${sanitized} (${fieldName})`
      : `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (${fieldName})`
  }
  const relationshipIndexes = table.fields
    .filter(isRelationshipField)
    .filter(relationshipFieldCreatesForeignKey)
    .map((field) => fkIndexSql(field.name))

  const userFieldIndexes = table.fields.filter(isUserField).map((field) => fkIndexSql(field.name))

  return [...relationshipIndexes, ...userFieldIndexes]
}

export const generateIndexStatements = (table: Table): readonly string[] => [
  ...generateStandardIndexes(table),
  ...generateAutonumberIndexes(table),
  ...generateGeolocationConstraints(table),
  ...generateFullTextSearchIndexes(table),
  ...generateCustomIndexes(table),
  ...generateForeignKeyIndexes(table),
  ...generateDeletedAtIndex(table),
]
