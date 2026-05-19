/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRelationshipField, isUserField } from '../sql/sql-generators'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

const generateStandardIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  return table.fields
    .filter(
      (field): field is Fields[number] & { indexed: true } => 'indexed' in field && !!field.indexed
    )
    .map((field) => {
      const indexSuffix = field.type === 'status' ? 'status' : field.name
      const indexName = `idx_${sanitized}_${indexSuffix}`
      const indexType =
        field.type === 'array' || field.type === 'json'
          ? 'USING gin'
          : field.type === 'geolocation'
            ? 'USING gist'
            : 'USING btree'
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} ${indexType} (${field.name})`
    })
}

const generateAutonumberIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  return table.fields
    .filter((field) => field.type === 'autonumber')
    .map((field) => {
      const indexName = `idx_${sanitized}_${field.name}_unique`
      return `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} (${field.name})`
    })
}

const generateGeolocationConstraints = (table: Table): readonly string[] => {
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
  return (
    table.indexes?.map((index) => {
      const uniqueClause = index.unique ? 'UNIQUE ' : ''
      const fields = index.fields.join(', ')
      const whereClause = 'where' in index && index.where ? ` WHERE ${index.where}` : ''
      return `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${index.name} ON public.${sanitized} (${fields})${whereClause}`
    }) ?? []
  )
}

const generateDeletedAtIndex = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const indexName = `idx_${sanitized}_deleted_at`
  return [`CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (deleted_at)`]
}

const generateForeignKeyIndexes = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const relationshipIndexes = table.fields
    .filter(isRelationshipField)
    .filter((field) => {
      return (
        !('relationType' in field) ||
        (field.relationType !== 'one-to-many' && field.relationType !== 'many-to-many')
      )
    })
    .map((field) => {
      const indexName = `idx_${sanitized}_${field.name}_fk`
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (${field.name})`
    })

  const userFieldIndexes = table.fields.filter(isUserField).map((field) => {
    const indexName = `idx_${sanitized}_${field.name}_fk`
    return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (${field.name})`
  })

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
