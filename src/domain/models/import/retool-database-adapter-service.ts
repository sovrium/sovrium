/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of a Retool Database snapshot: a PostgreSQL database read by
 * `sovrium import fetch retool-db:…`, its catalogue and its rows.
 *
 * ```
 * raw/schema/columns.json                  information_schema.columns
 * raw/schema/table-constraints.json        information_schema.table_constraints
 * raw/schema/key-column-usage.json         information_schema.key_column_usage
 * raw/schema/constraint-column-usage.json  information_schema.constraint_column_usage
 * raw/tables/<n>/rows-0001.json …          { "rows": [row_to_json(t), …] }, per table
 * ```
 *
 * Tables are numbered in (schema, table) order, the order the fetch read
 * them in, so a table's folder never carries its name.
 *
 * - A column keeps its PostgreSQL `data_type` as its source type; the Retool
 *   Database mapping table reads it.
 * - **Identity.** A one-column primary key is the record id: its values key
 *   the records, and it is not a field of its own (it becomes `source_id`).
 *   A composite key joins its values with `/`; a table with no primary key is
 *   keyed by row position, and the report says so.
 * - **Links.** A one-column foreign key becomes a relationship to the table
 *   it references, each value a link to the row holding it. A composite
 *   foreign key stays as plain columns.
 * - A one-column UNIQUE constraint is kept as `unique`.
 *
 * Constraints are joined on schema, table and name together: PostgreSQL does
 * not make a constraint name unique within a schema.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { type Json } from './baserow-field-service'
import type {
  CanonicalBase,
  CanonicalField,
  CanonicalRecord,
  CanonicalTable,
  CanonicalValue,
} from './canonical-base'
import type { RecordIdentity, TableAdapterResult } from './tabular-adapter-service'

/** The snapshot paths of the four catalogue reads. */
export const RETOOL_SCHEMA_PATHS = {
  columns: 'raw/schema/columns.json',
  tableConstraints: 'raw/schema/table-constraints.json',
  keyColumnUsage: 'raw/schema/key-column-usage.json',
  constraintColumnUsage: 'raw/schema/constraint-column-usage.json',
} as const

/** One table of the database, by schema and name. */
export interface RetoolTableRef {
  readonly schema: string
  readonly table: string
}

/** The folder of the n-th table (0-based), as the fetch and the adapter both name it. */
export const retoolRowsPath = (index: number, page: number): string =>
  `raw/tables/${String(index + 1).padStart(4, '0')}/rows-${String(page).padStart(4, '0')}.json`

const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''))

/** Every table the columns name, in (schema, table) order. */
export const retoolTablesOf = (columns: unknown): readonly RetoolTableRef[] => {
  const keys = new Set(
    arrayOf(columns)
      .filter(isRecord)
      .map((column) => JSON.stringify([text(column['table_schema']), text(column['table_name'])]))
  )
  return [...keys]
    .map((key) => JSON.parse(key) as readonly [string, string])
    .toSorted(([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d))
    .map(([schema, table]) => ({ schema, table }))
}

const keyOf = (ref: RetoolTableRef): string => `${ref.schema}.${ref.table}`

const sameTable = (row: Json, ref: RetoolTableRef): boolean =>
  text(row['table_schema']) === ref.schema && text(row['table_name']) === ref.table

/** One constraint: its type, its table, its columns in order, and what it references. */
interface Constraint {
  readonly type: string
  readonly table: string
  readonly columns: readonly string[]
  readonly references?: { readonly table: string; readonly column: string }
}

/** A constraint's identity: its schema and name, on its table. */
const named = (row: Json): string =>
  `${text(row['constraint_schema'])}.${text(row['constraint_name'])}@${text(row['table_schema'])}.${text(row['table_name'])}`

/** The constraints of the catalogue, joined on schema, table and name. */
const constraintsOf = (raw: ReadonlyMap<string, unknown>): readonly Constraint[] => {
  const keys = arrayOf(raw.get(RETOOL_SCHEMA_PATHS.keyColumnUsage)).filter(isRecord)
  const targets = arrayOf(raw.get(RETOOL_SCHEMA_PATHS.constraintColumnUsage)).filter(isRecord)
  return arrayOf(raw.get(RETOOL_SCHEMA_PATHS.tableConstraints))
    .filter(isRecord)
    .map((constraint) => {
      const id = named(constraint)
      const columns = keys
        .filter((key) => named(key) === id)
        .toSorted((a, b) => Number(a['ordinal_position']) - Number(b['ordinal_position']))
        .map((key) => text(key['column_name']))
      const target = targets.find(
        (row) =>
          text(row['constraint_schema']) === text(constraint['constraint_schema']) &&
          text(row['constraint_name']) === text(constraint['constraint_name'])
      )
      const type = text(constraint['constraint_type'])
      return {
        type,
        table: `${text(constraint['table_schema'])}.${text(constraint['table_name'])}`,
        columns,
        ...(type === 'FOREIGN KEY' && target !== undefined
          ? {
              references: {
                table: `${text(target['table_schema'])}.${text(target['table_name'])}`,
                column: text(target['column_name']),
              },
            }
          : {}),
      }
    })
}

/** Every row of the n-th table, page after page. */
const rowsOf = (raw: ReadonlyMap<string, unknown>, index: number): readonly Json[] => {
  const pages = (page: number): readonly Json[] => {
    const held = raw.get(retoolRowsPath(index, page))
    if (held === undefined) return []
    return [
      ...arrayOf(isRecord(held) ? held['rows'] : undefined).filter(isRecord),
      ...pages(page + 1),
    ]
  }
  return pages(1)
}

/** A record id from one or several key values. */
const idFrom = (row: Json, columns: readonly string[]): string =>
  columns.map((column) => text(row[column])).join('/')

/** A whole-seconds count from an ISO 8601 interval with no year or month part. */
const ISO_INTERVAL = /^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

const intervalSeconds = (value: string): number | undefined => {
  const match = ISO_INTERVAL.exec(value)
  if (match === null) return undefined
  const [days, hours, minutes, seconds] = [match[2], match[3], match[4], match[5]].map((part) =>
    Number(part ?? 0)
  )
  const total = (days ?? 0) * 86_400 + (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  return match[1] === '-' ? -total : total
}

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value))

/** One cell as a canonical value: JSON kept as its text, an interval as seconds. */
const cellOf = (type: string, value: unknown): CanonicalValue | undefined => {
  if (value === null || value === undefined) return undefined
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value)
  if (type === 'interval') return typeof value === 'string' ? intervalSeconds(value) : undefined
  if (Array.isArray(value)) {
    return value.every(isScalar) ? (value as CanonicalValue) : JSON.stringify(value)
  }
  return isScalar(value) ? value : JSON.stringify(value)
}

/** What a table's keys decide: its id columns and its links. */
interface TableKeys {
  readonly idColumns: readonly string[]
  /** Whether the id column is hidden as a field (a one-column primary key). */
  readonly hidden: string | undefined
  readonly links: ReadonlyMap<string, { readonly table: string; readonly column: string }>
  readonly unique: ReadonlySet<string>
}

const keysOf = (constraints: readonly Constraint[], key: string): TableKeys => {
  const own = constraints.filter((constraint) => constraint.table === key)
  const primary = own.find((constraint) => constraint.type === 'PRIMARY KEY')?.columns ?? []
  const links = own.flatMap((constraint) =>
    constraint.type === 'FOREIGN KEY' &&
    constraint.columns.length === 1 &&
    constraint.references !== undefined
      ? [[constraint.columns[0] ?? '', constraint.references] as const]
      : []
  )
  const unique = own.flatMap((constraint) =>
    constraint.type === 'UNIQUE' && constraint.columns.length === 1 ? constraint.columns : []
  )
  return {
    idColumns: primary,
    hidden: primary.length === 1 ? primary[0] : undefined,
    links: new Map(links),
    unique: new Set(unique),
  }
}

const fieldsOf = (columns: readonly Json[], keys: TableKeys): readonly CanonicalField[] =>
  columns
    .filter((column) => text(column['column_name']) !== keys.hidden)
    .toSorted((a, b) => Number(a['ordinal_position']) - Number(b['ordinal_position']))
    .map((column) => {
      const name = text(column['column_name'])
      const link = keys.links.get(name)
      return {
        sourceId: name,
        name,
        sourceType: link === undefined ? text(column['data_type']) : 'FOREIGN KEY',
        options: {
          udt_name: text(column['udt_name']),
          is_nullable: text(column['is_nullable']),
          ...(link === undefined ? {} : { linkedTableId: link.table, references: link.column }),
          ...(keys.unique.has(name) ? { unique: true } : {}),
        },
      }
    })

/** The record id of the linked row: the referenced value itself, or the row holding it. */
type LinkResolver = (table: string, column: string, value: unknown) => string | undefined

const recordsOf = (
  rows: readonly Json[],
  fields: readonly CanonicalField[],
  keys: TableKeys,
  resolve: LinkResolver
): readonly CanonicalRecord[] =>
  rows.map((row, index) => {
    const values = Object.fromEntries(
      fields.flatMap((field) => {
        const raw = row[field.name]
        const link = keys.links.get(field.name)
        if (link !== undefined) {
          const record =
            raw === null || raw === undefined ? undefined : resolve(link.table, link.column, raw)
          return record === undefined
            ? []
            : [[field.sourceId, { kind: 'link', table: link.table, record }] as const]
        }
        const value = cellOf(field.sourceType, raw)
        return value === undefined ? [] : [[field.sourceId, value] as const]
      })
    )
    const sourceId =
      keys.idColumns.length === 0 ? `row-${String(index + 1)}` : idFrom(row, keys.idColumns)
    return { sourceId, values }
  })

/** The name a table is shown under: its own in `public`, prefixed by its schema elsewhere. */
const shownName = (ref: RetoolTableRef): string =>
  ref.schema === 'public' ? ref.table : `${ref.schema} ${ref.table}`

/**
 * A Retool Database snapshot as one base.
 *
 * @param raw - every `raw/` file of the snapshot, parsed, by snapshot path.
 */
export const adaptRetoolDatabaseSnapshot = (
  raw: ReadonlyMap<string, unknown>
): TableAdapterResult => {
  const columns = arrayOf(raw.get(RETOOL_SCHEMA_PATHS.columns)).filter(isRecord)
  const refs = retoolTablesOf(columns)
  const constraints = constraintsOf(raw)
  const rows = new Map(refs.map((ref, index) => [keyOf(ref), rowsOf(raw, index)] as const))
  const keys = new Map(refs.map((ref) => [keyOf(ref), keysOf(constraints, keyOf(ref))] as const))
  const resolve: LinkResolver = (table, column, value) => {
    const target = keys.get(table)
    if (target === undefined) return undefined
    if (target.idColumns.length === 1 && target.idColumns[0] === column) return text(value)
    const index = (rows.get(table) ?? []).findIndex((row) => text(row[column]) === text(value))
    const held = rows.get(table)?.[index]
    if (held === undefined) return undefined
    return target.idColumns.length === 0
      ? `row-${String(index + 1)}`
      : idFrom(held, target.idColumns)
  }
  const tables: readonly CanonicalTable[] = refs.map((ref) => {
    const key = keyOf(ref)
    const tableKeys = keys.get(key) ?? keysOf([], key)
    const fields = fieldsOf(
      columns.filter((column) => sameTable(column, ref)),
      tableKeys
    )
    return {
      sourceId: key,
      name: shownName(ref),
      fields,
      views: [],
      records: recordsOf(rows.get(key) ?? [], fields, tableKeys, resolve),
    }
  })
  const base: CanonicalBase = {
    tool: 'retool-database',
    sourceId: 'retool-database',
    name: 'Retool Database',
    tables,
    users: [],
    neverImportable: [],
  }
  const identities = Object.fromEntries(
    tables.map((table) => {
      const identity: RecordIdentity =
        (keys.get(table.sourceId)?.idColumns.length ?? 0) === 0 ? 'row-position' : 'source-id'
      return [table.sourceId, identity] as const
    })
  )
  return { base, identities }
}
