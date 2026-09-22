/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  isRelationshipField,
  isUserField,
  relationshipFieldCreatesForeignKey,
} from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * The table reference used in a `CREATE INDEX ... ON <ref>` statement.
 *
 * PostgreSQL qualifies the table with the `public` schema; SQLite has no
 * schemas, so the bare table name is used.
 */
const indexTableRef = (sanitized: string): string =>
  isSqliteRuntime() ? sanitized : `public.${sanitized}`

/**
 * Generate standard indexes for indexed fields.
 *
 * PostgreSQL picks an access method per field type: `gin` for `array` / `json`
 * containers, `gist` for `geolocation`, `btree` otherwise. SQLite has a single
 * b-tree index type and no `USING` clause — `gin` / `gist` indexes are a
 * Postgres-only optimization that degrades on SQLite:
 *
 *   - `btree` fields → a plain `CREATE INDEX` (the b-tree is implicit).
 *   - `gin` / `gist` fields (`array` / `json` / `geolocation`) → **skipped**.
 *     The column itself still exists and is queryable; only the specialized
 *     index is omitted.
 */
/**
 * The name of the standard (non-unique, non-fulltext, non-FK) index for a field.
 *
 * **Exported because the DROP path must derive the identical name.** Two rules
 * are easy to lose when the name is rebuilt by hand, and both were:
 *
 *   1. The table name is *sanitized*. `table.name` is user-facing config and
 *      legally contains spaces and hyphens (`^[a-zA-Z][a-zA-Z0-9_\s-]*$`), so
 *      `'My Projects'` becomes `my_projects`. Interpolating the raw name yields
 *      `idx_My Projects_x` — an unquoted identifier containing a space, i.e. a
 *      SQL syntax error rather than a silent miss.
 *   2. `status` fields are named by *type*, not by field name, so a table can
 *      carry only one status index.
 *
 * Any code that creates, drops, or looks up one of these indexes must call this
 * rather than re-deriving the string.
 */
export const standardIndexName = (
  tableName: string,
  field: { readonly name?: string | undefined; readonly type?: string | undefined }
): string => {
  const suffix = field.type === 'status' ? 'status' : field.name
  return `idx_${sanitizeTableName(tableName)}_${suffix}`
}

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
      // SQLite has no GIN/GiST — skip those indexes (the column still works).
      if (sqlite && (needsGin || needsGist)) return []
      const indexName = standardIndexName(table.name, field)
      if (sqlite) {
        return [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${sanitized} (${field.name})`]
      }
      const indexType = needsGin ? 'USING gin' : needsGist ? 'USING gist' : 'USING btree'
      return [
        `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} ${indexType} (${field.name})`,
      ]
    })
}

/**
 * Generate unique indexes for autonumber fields
 */
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

/**
 * Generate exclusion constraints for geolocation fields with unique constraint
 * NOTE: POINT type doesn't support btree UNIQUE constraints or GiST UNIQUE indexes
 * PostgreSQL requires EXCLUDE USING gist for uniqueness on geometric types using ~= operator
 */
const generateGeolocationConstraints = (table: Table): readonly string[] => {
  // `EXCLUDE USING gist` is a PostgreSQL-only constraint; SQLite has neither
  // GiST nor exclusion constraints, so geolocation uniqueness degrades there.
  if (isSqliteRuntime()) return []
  const sanitized = sanitizeTableName(table.name)
  return table.fields
    .filter(
      (field): field is Fields[number] & { type: 'geolocation'; unique: true } =>
        field.type === 'geolocation' && 'unique' in field && !!field.unique
    )
    .map((field) => {
      // Use PostgreSQL naming convention: {table}_{column}_key (matches constraint naming)
      const constraintName = `${sanitized}_${field.name}_key`
      return `ALTER TABLE public.${sanitized} ADD CONSTRAINT ${constraintName} EXCLUDE USING gist (${field.name} WITH ~=)`
    })
}

/**
 * Generate full-text search GIN indexes for rich-text fields.
 *
 * The `to_tsvector` GIN index is PostgreSQL-only — full-text search degrades
 * to `501 requires-postgres` on SQLite (plan decision §4), so no FTS index is
 * emitted there.
 */
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

/**
 * Generate custom indexes from table.indexes configuration.
 *
 * Custom indexes are plain b-tree indexes on a column list — portable across
 * both dialects; only the table reference is schema-qualified on Postgres.
 */
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

/**
 * Generate index for intrinsic deleted_at column (soft-delete optimization)
 * This index improves performance for common soft-delete queries:
 * - WHERE deleted_at IS NULL (active records)
 * - WHERE deleted_at IS NOT NULL (deleted records)
 */
const generateDeletedAtIndex = (table: Table): readonly string[] => {
  const sanitized = sanitizeTableName(table.name)
  const indexName = `idx_${sanitized}_deleted_at`
  return isSqliteRuntime()
    ? [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${sanitized} (deleted_at)`]
    : [`CREATE INDEX IF NOT EXISTS ${indexName} ON public.${sanitized} USING btree (deleted_at)`]
}

/**
 * Generate indexes for foreign key columns (relationship and user fields)
 * Foreign key columns benefit from indexes for JOIN operations and referential integrity checks
 * This improves query performance when filtering or joining on relationships
 */
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
    // Only many-to-one relationships place a FK on this table; index only those.
    .filter(relationshipFieldCreatesForeignKey)
    .map((field) => fkIndexSql(field.name))

  const userFieldIndexes = table.fields.filter(isUserField).map((field) => fkIndexSql(field.name))

  return [...relationshipIndexes, ...userFieldIndexes]
}

/**
 * Generate CREATE INDEX statements for indexed fields and autonumber fields
 */
export const generateIndexStatements = (table: Table): readonly string[] => [
  ...generateStandardIndexes(table),
  ...generateAutonumberIndexes(table),
  ...generateGeolocationConstraints(table),
  ...generateFullTextSearchIndexes(table),
  ...generateCustomIndexes(table),
  ...generateForeignKeyIndexes(table),
  ...generateDeletedAtIndex(table),
]
