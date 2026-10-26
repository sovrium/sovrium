/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  deriveFieldLinkTableName,
  type LinkField,
  type LinkSourceTable,
} from '@/domain/models/app/tables/table-derived-name-validation'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { resolvePrimaryKeyColumnType } from '../table-operations/column-generators'

/**
 * The link table a many-to-many `field` of `source` stores its links in:
 * `{table}_{related}` while it is the table's only many-to-many to the related
 * table, `{table}_{related}_{field}` once two or more fields point there
 * (`deriveFieldLinkTableName`).
 *
 * Built from the DATABASE names of both tables, so a config name such as
 * `client-accounts` yields a usable identifier. Idempotent on names that are
 * already derived. `source.fields` must be the table's own fields: the name
 * depends on its other many-to-many fields.
 */
export const generateJunctionTableName = (source: LinkSourceTable, field: LinkField): string =>
  deriveFieldLinkTableName(source, field)

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

/** The length PostgreSQL keeps of an identifier: it cuts a longer one, silently. */
const POSTGRES_IDENTIFIER_LENGTH = 63

/**
 * The name PostgreSQL stores a relation called `name` under: its first 63
 * characters. A link table named after two tables and a field can be longer,
 * and the catalog then lists the cut name, never the one the config derives.
 */
export const postgresStoredName = (name: string): string =>
  name.slice(0, POSTGRES_IDENTIFIER_LENGTH)

/**
 * Whether a relation called `name` is among the `live` table names the
 * catalog lists: under its own name, or, on PostgreSQL, under the 63
 * characters it keeps of a longer one.
 */
export const isLiveRelation = (live: ReadonlySet<string>, name: string): boolean =>
  live.has(name) || (!isSqliteRuntime() && live.has(postgresStoredName(name)))

/**
 * `base` then `suffix`, `base` cut so the whole fits in 63 characters — the
 * shape PostgreSQL gives a name it derives itself. Cutting the whole name
 * instead would cut the suffix first, and the two foreign keys of a long link
 * table would then take one name, which PostgreSQL refuses.
 */
const fittedName = (base: string, suffix: string): string => {
  const full = `${base}${suffix}`
  return full.length <= POSTGRES_IDENTIFIER_LENGTH
    ? full
    : `${base.slice(0, Math.max(0, POSTGRES_IDENTIFIER_LENGTH - suffix.length))}${suffix}`
}

/** The name of a link table's foreign key on `column`: `<link table>_<column>_fkey`, fitted. */
export const junctionForeignKeyName = (junction: string, column: string): string =>
  fittedName(junction, `_${column}_fkey`)

/** The name PostgreSQL gives a link table's primary key: `<link table>_pkey`, fitted. */
export const junctionPrimaryKeyName = (junction: string): string => fittedName(junction, '_pkey')

/**
 * The names a link table's foreign key on `column` may carry today: the fitted
 * one, and the one an earlier version wrote, cut by PostgreSQL at 63
 * characters. The same while the name fits.
 */
export const junctionForeignKeyNamesBefore = (
  junction: string,
  column: string
): readonly string[] => [
  ...new Set([
    junctionForeignKeyName(junction, column),
    postgresStoredName(`${junction}_${column}_fkey`),
  ]),
]

/** One key column of a link table and the relation it references. */
interface JunctionKey {
  readonly column: string
  readonly keyName: string
  readonly references: string
  readonly configName: string
}

/**
 * The two key columns of the link table between `sourceTable` and
 * `relatedTable`, each with its foreign key's name and the relation it
 * references: the database name, or the `<name>_base` holding a view-backed
 * table's rows. `tableUsesView` is keyed by CONFIG name.
 */
const junctionKeys = (
  source: LinkSourceTable,
  field: LinkField,
  tableUsesView?: ReadonlyMap<string, boolean>
): readonly [JunctionKey, JunctionKey] => {
  const junctionTableName = generateJunctionTableName(source, field)
  const [sourceColumn, relatedColumn] = junctionKeyColumns(source.name, field.relatedTable)
  const keyOf = (configName: string, column: string): JunctionKey => {
    const name = sanitizeTableName(configName)
    return {
      column,
      configName,
      keyName: junctionForeignKeyName(junctionTableName, column),
      references: quoteSqlIdentifier(
        tableUsesView?.get(configName) === true ? `${name}_base` : name
      ),
    }
  }
  return [keyOf(source.name, sourceColumn), keyOf(field.relatedTable, relatedColumn)]
}

/**
 * Generate CREATE TABLE statement for junction table (many-to-many relationship)
 *
 * Junction tables have:
 * - Two foreign key columns: {sourceTable}_id, {relatedTable}_id (singular form;
 *   see {@link junctionKeyColumns} for a table linked to itself)
 * - Composite primary key on both columns
 * - Foreign key constraints to both tables
 *
 * Each key column takes the type of the key it references, read from
 * `tablePrimaryKeyTypes` (CONFIG name → `primaryKey.type`, built from the
 * defaulted tables): a table listed in `auth.scopeTables` is keyed by text, and
 * PostgreSQL refuses a foreign key from an integer column onto it. A table the
 * map does not name keeps the default serial key's `INTEGER`.
 */
export const generateJunctionTableDDL = (
  sourceTable: LinkSourceTable,
  field: LinkField,
  tableUsesView?: ReadonlyMap<string, boolean>,
  tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
): string => {
  const junctionTableName = generateJunctionTableName(sourceTable, field)
  const [source, related] = junctionKeys(sourceTable, field, tableUsesView)
  const columnType = (key: JunctionKey): string =>
    resolvePrimaryKeyColumnType(tablePrimaryKeyTypes?.get(key.configName))

  const columns = [
    `${source.column} ${columnType(source)} NOT NULL`,
    `${related.column} ${columnType(related)} NOT NULL`,
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
  sourceTable: LinkSourceTable,
  field: LinkField,
  tableUsesView?: ReadonlyMap<string, boolean>
): readonly string[] => {
  const junctionTableName = generateJunctionTableName(sourceTable, field)
  return junctionKeys(sourceTable, field, tableUsesView).map(
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

/**
 * PostgreSQL: the statements that give a link table moved to `junction` the
 * constraint names a fresh boot would give it — its primary key, and its
 * foreign key on each of `columns` (each `[name before, name after]`).
 *
 * Each is found in the catalog rather than assumed: the primary key by its
 * kind, whatever PostgreSQL named it, and each foreign key under any name an
 * earlier version gave it (`from` is the link table it was created as). A
 * constraint that is not there is left alone, so a link table created under
 * other names never stops the move, and so is one whose new name another
 * relation already takes: a primary key is an index, and two long link tables
 * of one table fit to the same name, which PostgreSQL then numbered.
 */
export const generateJunctionConstraintRenameSQL = (
  from: string,
  junction: string,
  columns: readonly (readonly [before: string, after: string])[]
): readonly string[] => {
  const table = postgresStoredName(junction)
  const rename = (found: string, after: string): string => `DO $$
DECLARE current_name text;
BEGIN
  SELECT conname INTO current_name FROM pg_constraint WHERE conrelid = '${table}'::regclass AND ${found} LIMIT 1;
  IF current_name IS NOT NULL AND current_name <> '${after}'
    AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '${after}' AND relnamespace = (SELECT relnamespace FROM pg_class WHERE oid = '${table}'::regclass)) THEN
    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', '${table}', current_name, '${after}');
  END IF;
END $$`
  return [
    rename(`contype = 'p'`, postgresStoredName(junctionPrimaryKeyName(junction))),
    ...columns.map(([before, after]) => {
      const names = junctionForeignKeyNamesBefore(from, before)
        .map((name) => `'${postgresStoredName(name)}'`)
        .join(', ')
      return rename(
        `contype = 'f' AND conname IN (${names})`,
        postgresStoredName(junctionForeignKeyName(junction, after))
      )
    }),
  ]
}
