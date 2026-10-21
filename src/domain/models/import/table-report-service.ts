/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the table mapper reports for each decided table: the parts kept through
 * a fallback (`unmapped`), the parts left to finish (`todo`), and one line per
 * field for the report's `tables` section.
 *
 * - A field whose type has no Sovrium equivalent is reported with the text it
 *   fell back to.
 * - A field renamed because its name is a column Sovrium writes itself, or
 *   because it was called `source_id`, is reported with its new name.
 * - A table or field name cut to fit the 63 characters a Sovrium name may
 *   have is reported with its full name.
 */

import { SOURCE_ID_FIELD, UNMAPPED_FIELD_TYPE } from './field-type-mappings'
import { MAX_NAME_LENGTH } from './import-names-service'
import { renamedSystemColumn } from './system-column-names-service'
import { viewsUnmapped } from './table-views-mapper-service'
import type { CanonicalField, CanonicalTable } from './canonical-base'
import type { FieldDecision } from './field-decision-service'
import type { ImportReport } from './import-report'

/** The name a source field called `source_id` is renamed to. */
export const RENAMED_SOURCE_ID_FIELD = `source_${SOURCE_ID_FIELD}`

type TablesSection = NonNullable<ImportReport['tables']>
type Unmapped = ImportReport['unmapped'][number]
type Todo = ImportReport['todo'][number]

/** One field, decided. */
export interface Row {
  readonly field: CanonicalField
  readonly name: string
  /** The name before it was cut to fit, when it was. */
  readonly shortenedFrom?: string
  readonly decision: FieldDecision
}

/** One table, decided. */
export interface Decided {
  readonly table: CanonicalTable
  readonly name: string
  /** The name before it was cut to fit, when it was. */
  readonly shortenedFrom?: string
  readonly rows: readonly Row[]
}

const tooLong = (full: string): string =>
  `"${full}" is longer than the ${String(MAX_NAME_LENGTH)} characters a Sovrium name may have, so it was shortened; formulas that read it use the new name.`

const where = (table: CanonicalTable, row: Row) =>
  `${table.name}.${row.field.name} (${row.field.sourceType})`

export const unmappedOf = (one: Decided): readonly Unmapped[] => [
  ...one.rows
    .filter((row) => row.decision.outcome === 'unmapped')
    .map((row) => ({
      domain: 'tables' as const,
      source: where(one.table, row),
      kind: 'field-type' as const,
      reason: row.decision.reason ?? 'No equivalent field type.',
      fallback: UNMAPPED_FIELD_TYPE,
    })),
  ...one.rows
    .filter((row) => renamedSystemColumn(row.name, row.field.name) !== undefined)
    .map((row) => ({
      domain: 'tables' as const,
      source: where(one.table, row),
      kind: 'other' as const,
      reason: `"${renamedSystemColumn(row.name, row.field.name) ?? ''}" is a column Sovrium writes itself, so this field was renamed.`,
      fallback: row.name,
    })),
  ...one.rows
    .filter((row) => row.name === RENAMED_SOURCE_ID_FIELD)
    .map((row) => ({
      domain: 'tables' as const,
      source: where(one.table, row),
      kind: 'other' as const,
      reason: `"${SOURCE_ID_FIELD}" holds the source record id on every imported table, so this field was renamed.`,
      fallback: RENAMED_SOURCE_ID_FIELD,
    })),
  ...one.rows
    .filter((row) => row.shortenedFrom !== undefined)
    .map((row) => ({
      domain: 'tables' as const,
      source: where(one.table, row),
      kind: 'other' as const,
      reason: tooLong(row.shortenedFrom ?? ''),
      fallback: row.name,
    })),
  ...(one.shortenedFrom === undefined
    ? []
    : [
        {
          domain: 'tables' as const,
          source: one.table.name,
          kind: 'other' as const,
          reason: tooLong(one.shortenedFrom),
          fallback: one.name,
        },
      ]),
  ...viewsUnmapped(one.table),
]

export const todoOf = (one: Decided): readonly Todo[] =>
  one.rows.flatMap((row) =>
    row.decision.todo === undefined
      ? []
      : [
          {
            domain: 'tables' as const,
            target: `tables.${one.name}.fields.${row.name}`,
            original: row.decision.todo.original,
            reason: row.decision.todo.reason,
          },
        ]
  )

export const sectionFields = (one: Decided): TablesSection['fields'] => [
  ...one.rows.map((row) => ({
    table: one.name,
    field: row.name,
    sourceType: row.field.sourceType,
    type: row.decision.type,
    outcome: row.decision.outcome,
    ...(row.decision.reason === undefined ? {} : { reason: row.decision.reason }),
  })),
  {
    table: one.name,
    field: SOURCE_ID_FIELD,
    sourceType: 'record id',
    type: 'single-line-text',
    outcome: 'mapped' as const,
  },
]
