/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Generate standard indexes for indexed fields
 */
const generateStandardIndexes = (table: Table): readonly string[] =>
  table.fields
    .filter(
      (field): field is Fields[number] & { indexed: true } => 'indexed' in field && !!field.indexed
    )
    .map((field) => {
      // Status fields use special naming: idx_{table}_status instead of idx_{table}_{field_name}
      const indexSuffix = field.type === 'status' ? 'status' : field.name
      const indexName = `idx_${table.name}_${indexSuffix}`
      const indexType =
        field.type === 'array' || field.type === 'json'
          ? 'USING gin'
          : field.type === 'geolocation'
            ? 'USING gist'
            : 'USING btree'
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${table.name} ${indexType} (${field.name})`
    })

/**
 * Generate unique indexes for autonumber fields
 */
const generateAutonumberIndexes = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => field.type === 'autonumber')
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}_unique`
      return `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON public.${table.name} (${field.name})`
    })

/**
 * Generate exclusion constraints for geolocation fields with unique constraint
 * NOTE: POINT type doesn't support btree UNIQUE constraints or GiST UNIQUE indexes
 * PostgreSQL requires EXCLUDE USING gist for uniqueness on geometric types using ~= operator
 */
const generateGeolocationConstraints = (table: Table): readonly string[] =>
  table.fields
    .filter(
      (field): field is Fields[number] & { type: 'geolocation'; unique: true } =>
        field.type === 'geolocation' && 'unique' in field && !!field.unique
    )
    .map((field) => {
      // Use PostgreSQL naming convention: {table}_{column}_key (matches constraint naming)
      const constraintName = `${table.name}_${field.name}_key`
      return `ALTER TABLE public.${table.name} ADD CONSTRAINT ${constraintName} EXCLUDE USING gist (${field.name} WITH ~=)`
    })

/**
 * Generate full-text search GIN indexes for rich-text fields
 */
const generateFullTextSearchIndexes = (table: Table): readonly string[] =>
  table.fields
    .filter(
      (field): field is Fields[number] & { type: 'rich-text'; fullTextSearch: true } =>
        field.type === 'rich-text' && 'fullTextSearch' in field && !!field.fullTextSearch
    )
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}_fulltext`
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${table.name} USING gin (to_tsvector('english'::regconfig, ${field.name}))`
    })

/**
 * Generate custom indexes from table.indexes configuration
 */
const generateCustomIndexes = (table: Table): readonly string[] =>
  table.indexes?.map((index) => {
    const uniqueClause = index.unique ? 'UNIQUE ' : ''
    const fields = index.fields.join(', ')
    return `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${index.name} ON public.${table.name} (${fields})`
  }) ?? []

/**
 * Generate CREATE INDEX statements for indexed fields and autonumber fields
 */
export const generateIndexStatements = (table: Table): readonly string[] => [
  ...generateStandardIndexes(table),
  ...generateAutonumberIndexes(table),
  ...generateGeolocationConstraints(table),
  ...generateFullTextSearchIndexes(table),
  ...generateCustomIndexes(table),
]
