/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { deriveLinkTableName } from '@/domain/models/app/tables/table-derived-name-validation'

/**
 * Generate junction table name for many-to-many relationship
 * Format: {table1}_{table2} (source table first, related table second)
 *
 * Built from the DATABASE names of both tables, so a config name such as
 * `client-accounts` yields a usable identifier. Idempotent on names that are
 * already derived, which is what every runtime caller passes.
 */
export const generateJunctionTableName = (sourceTable: string, relatedTable: string): string =>
  deriveLinkTableName(sourceTable, relatedTable)

/**
 * Common irregular plural to singular mappings for table naming
 * Used by toSingular() to handle irregular English plurals
 */
const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  teeth: 'tooth',
  feet: 'foot',
  geese: 'goose',
  mice: 'mouse',
  dice: 'die',
  oxen: 'ox',
  indices: 'index',
  matrices: 'matrix',
  vertices: 'vertex',
  analyses: 'analysis',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  data: 'datum',
  media: 'medium',
}

/**
 * Convert table name to singular form for junction table column naming
 * Uses irregular plural mapping with fallback to 's' removal heuristic
 */
export const toSingular = (tableName: string): string =>
  // Derived LAST, so a name that already worked keeps its column: `People`
  // singularises as it always did and only then becomes `people`, the name an
  // unquoted `People` always folded to.
  sanitizeTableName(
    IRREGULAR_PLURALS[tableName] ?? (tableName.endsWith('s') ? tableName.slice(0, -1) : tableName)
  )

/**
 * The two key columns of the link table between `sourceTable` and
 * `relatedTable`: the singular of each end followed by `_id` (`order_id`,
 * `client_id`). When both ends singularise to the same word — a table linked
 * to itself (`people` → `person_id`), or two tables such as `person` and
 * `people` — the related end's column is prefixed `related_`
 * (`person_id`, `related_person_id`), so the two columns never share a name.
 *
 * The one place a link table's key columns are named: the DDL, the link
 * writes and reads, the lookups through a link and the rename carry all ask
 * here, so they cannot disagree.
 */
export const junctionKeyColumns = (
  sourceTable: string,
  relatedTable: string
): readonly [source: string, related: string] => {
  const source = `${toSingular(sourceTable)}_id`
  const related = `${toSingular(relatedTable)}_id`
  return source === related ? [source, `related_${related}`] : [source, related]
}

/** One key column of a link table and the relation it references. */
interface JunctionKey {
  readonly column: string
  readonly keyName: string
  readonly references: string
}

/**
 * The two key columns of the link table between `sourceTable` and
 * `relatedTable`, each with its foreign key's name and the relation it
 * references: the database name, or the `<name>_base` holding a view-backed
 * table's rows. `tableUsesView` is keyed by CONFIG name.
 */
const junctionKeys = (
  sourceTable: string,
  relatedTable: string,
  tableUsesView?: ReadonlyMap<string, boolean>
): readonly [JunctionKey, JunctionKey] => {
  const junctionTableName = generateJunctionTableName(sourceTable, relatedTable)
  const [sourceColumn, relatedColumn] = junctionKeyColumns(sourceTable, relatedTable)
  const keyOf = (configName: string, column: string): JunctionKey => {
    const name = sanitizeTableName(configName)
    return {
      column,
      keyName: `${junctionTableName}_${column}_fkey`,
      references: quoteSqlIdentifier(
        tableUsesView?.get(configName) === true ? `${name}_base` : name
      ),
    }
  }
  return [keyOf(sourceTable, sourceColumn), keyOf(relatedTable, relatedColumn)]
}

/**
 * Generate CREATE TABLE statement for junction table (many-to-many relationship)
 *
 * Junction tables have:
 * - Two foreign key columns: {sourceTable}_id, {relatedTable}_id (singular form;
 *   see {@link junctionKeyColumns} for a table linked to itself)
 * - Composite primary key on both columns
 * - Foreign key constraints to both tables
 */
export const generateJunctionTableDDL = (
  sourceTable: string,
  relatedTable: string,
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  const junctionTableName = generateJunctionTableName(sourceTable, relatedTable)
  const [source, related] = junctionKeys(sourceTable, relatedTable, tableUsesView)

  const columns = [
    `${source.column} INTEGER NOT NULL`,
    `${related.column} INTEGER NOT NULL`,
    `PRIMARY KEY (${source.column}, ${related.column})`,
    ...[source, related].map(
      (key) =>
        `CONSTRAINT ${key.keyName} FOREIGN KEY (${key.column}) REFERENCES ${key.references}(id)`
    ),
  ]

  return `CREATE TABLE IF NOT EXISTS ${junctionTableName} (\n  ${columns.join(',\n  ')}\n)`
}

/**
 * PostgreSQL: put back a link table's foreign keys where one is missing.
 *
 * Rebuilding a table (a CHECK constraint added, a table renamed) ends in
 * `DROP TABLE <table> CASCADE`, and CASCADE takes every foreign key that
 * references it — including the link table's, which
 * {@link generateJunctionTableDDL}'s `CREATE TABLE IF NOT EXISTS` never
 * recreates, since the link table itself survives. A link could then name a
 * record that does not exist. One idempotent block per key column: a column
 * that already carries a foreign key is left alone, whatever its name, so a
 * name PostgreSQL truncated at 63 characters does not read as missing.
 *
 * The key is added `NOT VALID`, as the user foreign key reconciler adds its
 * own: every later write is checked, and a link written while the key was
 * missing does not stop the boot.
 */
export const generateJunctionForeignKeyRestoreSQL = (
  sourceTable: string,
  relatedTable: string,
  tableUsesView?: ReadonlyMap<string, boolean>
): readonly string[] => {
  const junctionTableName = generateJunctionTableName(sourceTable, relatedTable)
  return junctionKeys(sourceTable, relatedTable, tableUsesView).map(
    (key) => `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = '${junctionTableName}'::regclass AND c.contype = 'f' AND a.attname = '${key.column}'
  ) THEN
    ALTER TABLE ${junctionTableName} ADD CONSTRAINT ${key.keyName} FOREIGN KEY (${key.column}) REFERENCES ${key.references}(id) NOT VALID;
  END IF;
END $$`
  )
}
