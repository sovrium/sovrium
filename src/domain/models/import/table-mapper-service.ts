/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE table mapper: a `CanonicalBase` in, `tables[]` entries and the
 * report's `tables` section out, through the source's field-type table.
 *
 * - A source type the table lists becomes that Sovrium type with the settings
 *   it needs (`field-decision-service`); a lossy row says what it loses and the
 *   field is reported `degraded`.
 * - A source type the table does not list becomes `long-text`, its values kept
 *   as text, and the field is reported `unmapped`.
 * - A computed field whose settings cannot be had (a formula the translator
 *   refuses, a rollup with no stated aggregation) keeps its last computed
 *   values, and a TODO quotes the original.
 * - Sovrium refuses two tables whose computed fields read each other through
 *   their links. When the source has such a pair, the field of the LATER table
 *   keeps its last values instead, and the report says why.
 * - A field name that would take a column the engine writes itself is renamed
 *   `source_<name>`; any other table or field name that is a reserved SQL
 *   keyword gains a suffix (`key_field`). A source field its adapter marks
 *   `unique` (a UNIQUE column) keeps it.
 * - A table or field name longer than the 63 characters Sovrium accepts is
 *   cut, ending with a hash of the whole name so it stays unique; formulas
 *   and lookups read the new name, and the report gives the full one.
 * - Every table gains `source_id`, `single-line-text` and `unique`. A source
 *   field already named `source_id` is renamed `source_source_id`, and the
 *   report says so.
 */

import { findLookupCycle } from '@/domain/models/app/tables/lookup-cycle-validation'
import { declaredValueType, isComputedField } from './computed-field-service'
import { decideComputed, decideField, keptValues, type BaseIndex } from './field-decision-service'
import { lookupFieldType, SOURCE_ID_FIELD } from './field-type-mappings'
import {
  avoidReservedName,
  fitName,
  prefixedName,
  toSnakeName,
  uniqueNames,
} from './import-names-service'
import { linkKey, pairLinks } from './link-pairing-service'
import { isSystemColumnClash, SOURCE_PREFIX } from './system-column-names-service'
import {
  RENAMED_SOURCE_ID_FIELD,
  sectionFields,
  todoOf,
  unmappedOf,
  type Decided,
  type Row,
} from './table-report-service'
import {
  planViewIds,
  renamedViewsUnmapped,
  viewsEntry,
  type PlannedViewIds,
} from './table-views-mapper-service'
import type { CanonicalBase, CanonicalField, CanonicalTable } from './canonical-base'
import type { ConfigEntry } from './field-settings-service'
import type { TableSourceTool } from './field-type-mappings'
import type { ImportReport } from './import-report'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

export type { ConfigEntry } from './field-settings-service'
export { RENAMED_SOURCE_ID_FIELD } from './table-report-service'

type TablesSection = NonNullable<ImportReport['tables']>
type Unmapped = ImportReport['unmapped'][number]
type Todo = ImportReport['todo'][number]

/** How one source field landed: its Sovrium name and type, for the seed values. */
export interface MappedField {
  readonly source: CanonicalField
  readonly name: string
  readonly type: FieldType
  /** For a relationship: the Sovrium name of the linked table. */
  readonly relatedTable?: string
  /** For a relationship: whether one record links to several (many-to-many, one-to-many). */
  readonly multiple?: boolean
  /** Whether the seed writes this field; false for a computed or derived field. */
  readonly seeded: boolean
}

/** One table as mapped. */
export interface MappedTable {
  readonly source: CanonicalTable
  readonly name: string
  readonly entry: ConfigEntry
  readonly fields: readonly MappedField[]
}

/** The mapper's whole result. */
export interface TablePlan {
  readonly tables: readonly MappedTable[]
  readonly section: TablesSection
  readonly unmapped: readonly Unmapped[]
  readonly todo: readonly Todo[]
}

/** What the config already holds, so new names and ids never collide. */
export interface TableMappingContext {
  readonly tool: TableSourceTool
  readonly prefix?: string
  /** The largest numeric table id the config holds (0 when none). */
  readonly maxTableId: number
  /** Whether the app declares sign-in accounts (an `auth` block); true by default. */
  readonly accounts?: boolean
}

/** The name before it was cut to fit, as a spreadable entry: empty when it fit. */
const shortened = (full: string | undefined, name: string) =>
  full === undefined || full === name ? {} : { shortenedFrom: full }

/** The field names in full, unique in the table, before any is cut to fit. */
const fullFieldNamesOf = (table: CanonicalTable, context: TableMappingContext): readonly string[] =>
  uniqueNames(
    table.fields.map((field) => {
      const snake = toSnakeName(field.name)
      if (snake === SOURCE_ID_FIELD) return RENAMED_SOURCE_ID_FIELD
      if (isSystemColumnClash(snake, field, context)) return `${SOURCE_PREFIX}${snake}`
      return avoidReservedName(snake, 'field')
    }),
    'snake',
    new Set([SOURCE_ID_FIELD])
  )

/** The field names of a table, each cut to fit (`fitName`). */
const fieldNamesOf = (table: CanonicalTable, context: TableMappingContext): readonly string[] =>
  fullFieldNamesOf(table, context).map((name) => fitName(name, 'snake'))

/** Every name the decisions read: tables, fields, source names, link shapes. */
const indexOf = (
  base: CanonicalBase,
  context: TableMappingContext,
  tableNames: readonly string[]
): BaseIndex => {
  const fieldNames = base.tables.flatMap((table) => {
    const names = fieldNamesOf(table, context)
    return table.fields.map(
      (field, index) => [linkKey(table.sourceId, field.sourceId), names[index] ?? 'field'] as const
    )
  })
  return {
    tool: context.tool,
    tableNames: new Map(
      base.tables.map((table, index) => [table.sourceId, tableNames[index] ?? 'table'] as const)
    ),
    fieldNames: new Map(fieldNames),
    sourceNames: new Map(
      base.tables.flatMap((table) =>
        table.fields.map((field) => [linkKey(table.sourceId, field.sourceId), field.name] as const)
      )
    ),
    links: pairLinks(
      base,
      (field) => lookupFieldType(context.tool, field.sourceType).sovrium === 'relationship'
    ),
    accounts: context.accounts ?? true,
  }
}

/** The relation kinds in which one record links to several. */
const MULTIPLE_RELATIONS: ReadonlySet<string> = new Set(['many-to-many', 'one-to-many'])

/** The tables as the lookup-cycle rule reads them. */
const cycleShape = (decided: readonly Decided[]) =>
  decided.map((one) => ({
    name: one.name,
    fields: one.rows.map((row) => ({
      name: row.name,
      type: row.decision.type,
      ...(typeof row.decision.settings['relationshipField'] === 'string'
        ? { relationshipField: row.decision.settings['relationshipField'] }
        : {}),
      ...(row.decision.relatedTable === undefined
        ? {}
        : { relatedTable: row.decision.relatedTable }),
    })),
  }))

/**
 * A lookup's value type, for the formulas that read it: the type its source
 * declares for the looked-up value, when it reads through a link to ONE record
 * (a link to several gives a list, which a formula cannot use as one value).
 */
const lookupValueType = (index: BaseIndex, one: Decided, row: Row) => {
  if (row.decision.type !== 'lookup') return {}
  const link = one.rows.find((other) => other.name === row.decision.settings['relationshipField'])
  const shape =
    link === undefined
      ? undefined
      : index.links.get(linkKey(one.table.sourceId, link.field.sourceId))
  const valueType =
    shape?.relationType === 'many-to-one' ? declaredValueType(index.tool, row.field) : undefined
  return valueType === undefined ? {} : { valueType }
}

/**
 * Plan a table's formulas and rollups over its other fields as the first pass
 * typed them, so a formula knows what each field it reads became.
 */
const planComputed = (index: BaseIndex, one: Decided): Decided => {
  const siblings = one.rows.map((row) => ({
    sourceId: row.field.sourceId,
    label: row.field.name,
    name: row.name,
    type: row.decision.type,
    ...lookupValueType(index, one, row),
  }))
  return {
    ...one,
    rows: one.rows.map((row) =>
      isComputedField(index.tool, row.field)
        ? { ...row, decision: decideComputed(index, one.table, row.field, siblings) }
        : row
    ),
  }
}

const CYCLE_REASON =
  'Sovrium refuses two tables whose computed fields read each other through their links; this one keeps its last values.'

/**
 * Break every lookup cycle: the computed field of the latest table in the cycle
 * keeps its last values instead, until no cycle is left.
 */
const breakCycles = (index: BaseIndex, decided: readonly Decided[]): readonly Decided[] => {
  const cycle = findLookupCycle(cycleShape(decided))
  if (cycle === undefined) return decided
  const order = decided.map((one) => one.name)
  const last = cycle.toSorted((a, b) => order.indexOf(b.table) - order.indexOf(a.table))[0]
  return breakCycles(
    index,
    decided.map((one) =>
      one.name !== last?.table
        ? one
        : {
            ...one,
            rows: one.rows.map((row) =>
              row.name === last.field
                ? {
                    ...row,
                    decision: keptValues(
                      { index, table: one.table, field: row.field },
                      CYCLE_REASON
                    ),
                  }
                : row
            ),
          }
    )
  )
}

const SOURCE_ID_ENTRY = {
  name: SOURCE_ID_FIELD,
  label: 'Source ID',
  type: 'single-line-text',
  unique: true,
} as const

const mappedTable = (one: Decided, tableId: number, views: PlannedViewIds): MappedTable => {
  const entries = one.rows.map((row, index) => ({
    id: index + 1,
    name: row.name,
    label: row.field.name,
    type: row.decision.type,
    ...(row.field.description === undefined ? {} : { description: row.field.description }),
    ...(row.field.options?.['unique'] === true ? { unique: true } : {}),
    ...row.decision.settings,
  }))
  return {
    source: one.table,
    name: one.name,
    entry: {
      id: tableId,
      name: one.name,
      fields: [...entries, { id: one.rows.length + 1, ...SOURCE_ID_ENTRY }],
      ...viewsEntry(one.table, one.name, one.rows, views.ids),
    },
    fields: one.rows.map((row) => ({
      source: row.field,
      name: row.name,
      type: row.decision.type,
      seeded: row.decision.seeded,
      ...(row.decision.relatedTable === undefined
        ? {}
        : { relatedTable: row.decision.relatedTable }),
      ...(MULTIPLE_RELATIONS.has(String(row.decision.settings['relationType']))
        ? { multiple: true }
        : {}),
    })),
  }
}

/** A decided table as its view ids depend on it: its name and many-to-many targets. */
const viewNaming = (one: Decided) => ({
  table: one.table,
  name: one.name,
  manyToMany: one.rows.flatMap((row) =>
    row.decision.settings['relationType'] === 'many-to-many' &&
    row.decision.relatedTable !== undefined
      ? [{ name: row.name, relatedTable: row.decision.relatedTable }]
      : []
  ),
})

/**
 * Map a base onto `tables[]` entries.
 *
 * Table names are the source names in `snake_case`, `--prefix` applied; table
 * ids continue after the config's largest one.
 */
export const planTables = (base: CanonicalBase, context: TableMappingContext): TablePlan => {
  const fullNames = uniqueNames(
    base.tables.map((table) =>
      avoidReservedName(
        prefixedName(context.prefix, toSnakeName(table.name, 'table'), 'snake'),
        'table'
      )
    ),
    'snake'
  )
  const names = fullNames.map((name) => fitName(name, 'snake'))
  const index = indexOf(base, context, names)
  const decided = breakCycles(
    index,
    base.tables
      .map((table, tableIndex) => {
        const fullFieldNames = fullFieldNamesOf(table, context)
        const fieldNames = fieldNamesOf(table, context)
        const name = names[tableIndex] ?? 'table'
        return {
          table,
          name,
          ...shortened(fullNames[tableIndex], name),
          rows: table.fields.map((field, fieldIndex) => {
            const fieldName = fieldNames[fieldIndex] ?? 'field'
            return {
              field,
              name: fieldName,
              ...shortened(fullFieldNames[fieldIndex], fieldName),
              decision: decideField(index, table, field),
            }
          }),
        }
      })
      .map((one) => planComputed(index, one))
  )
  const views = planViewIds(decided.map(viewNaming))
  const viewsAt = (position: number): PlannedViewIds => views[position] ?? { ids: [], renamed: [] }
  return {
    tables: decided.map((one, position) =>
      mappedTable(one, context.maxTableId + position + 1, viewsAt(position))
    ),
    section: {
      created: decided.map((one) => ({
        name: one.name,
        source: one.table.name,
        fields: one.rows.length + 1,
      })),
      fields: decided.flatMap(sectionFields),
      views: decided.flatMap((one) =>
        one.table.views.map((view) => ({
          table: one.name,
          view: view.name,
          kind: view.kind,
          outcome: view.kind === 'grid' ? ('mapped' as const) : ('reported' as const),
        }))
      ),
      neverImportable: base.neverImportable,
    },
    unmapped: decided.flatMap((one, position) => [
      ...unmappedOf(one),
      ...renamedViewsUnmapped(one.table, viewsAt(position).renamed),
    ]),
    todo: decided.flatMap(todoOf),
  }
}
