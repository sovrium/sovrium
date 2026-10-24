/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How the page export writes a seeded value where a reader sees it: a grid
 * cell (its column's `format`, else its field type's default) and a record
 * view's `$record.<field>` (its field type's default). The formatting is the
 * domain's, the one the renderer reads a page with (`record-text-service.ts`,
 * `cell-value-format.ts`); this module resolves, per field, what it needs: the
 * page language, the operator zone (a field's own zone for a date-time, UTC for
 * a date), the export's clock (`--now`), an option's label, a currency.
 */

import { defaultLanguageTranslator } from '@/domain/models/app/languages/translation-resolver'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import {
  declaredCurrencyOf,
  fieldFormatOptionsOf,
  planFieldNamesOf,
  recordTextFieldOf,
  type PlanTable,
  type RecordTextResolvers,
} from '@/domain/models/app/tables/record-text-plan-service'
import { formatRecordText } from '@/domain/models/app/tables/record-text-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { App } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

type Field = Readonly<Record<string, unknown>>

/** What a value is written in: the page language, the operator zone, the clock, the app's languages. */
export interface ExportTextContext {
  readonly locale: string
  readonly zone: string
  readonly now?: Readonly<Date> | undefined
  readonly languages?: Languages | undefined
}

/** The language the pages are drawn in, as a locale: the default language's. */
const localeOf = (app: App): string => {
  const { languages } = app
  return (
    languages?.supported.find((language) => language.code === languages.default)?.locale ??
    languages?.default ??
    'en-US'
  )
}

/** The text context of an export: its pages' language, the operator zone, its clock. */
export const exportTextContextOf = (app: App, now?: Readonly<Date>): ExportTextContext => ({
  locale: localeOf(app),
  zone: parseSovriumTimezone().zoneId,
  now,
  languages: app.languages,
})

/** The tables a value is read against: the app's declared ones. */
type TablesLike = ReadonlyArray<{ readonly name: string; readonly fields: unknown }>

const planTablesOf = (tables: TablesLike): readonly PlanTable[] => tables as readonly PlanTable[]

/** An option field's labels, stored value → its label in the default language. */
const optionLabelsOf = (
  field: Field | undefined,
  context: ExportTextContext
): Readonly<Record<string, string>> => {
  const translated = defaultLanguageTranslator(context.languages)
  const options = Array.isArray(field?.['options']) ? (field['options'] as readonly unknown[]) : []
  return Object.fromEntries(
    options.map((option) => {
      if (typeof option !== 'object' || option === null) return [String(option), String(option)]
      const { value, label } = option as Field
      return [String(value), translated(String(label ?? value))]
    })
  )
}

/**
 * The resolvers the domain's plan builder reads a field with in an export: the
 * page language, the operator zone, an option's label in the default language,
 * and a field's currency as the domain declares it (a rollup inheriting its
 * source's), the same display the served page resolves.
 */
const resolversOf = (tables: TablesLike, context: ExportTextContext): RecordTextResolvers => ({
  locale: context.locale,
  timeZone: context.zone,
  optionLabels: (field) => optionLabelsOf(field, context),
  currencyOf: (table, fieldName) => declaredCurrencyOf(table, fieldName, planTablesOf(tables)),
})

const tableOf = (tables: TablesLike, table: string): PlanTable | undefined =>
  planTablesOf(tables).find((candidate) => candidate.name === table)

/**
 * Each field of a row whose type reads differently from what is stored, as
 * text, by name — the system timestamps (`createdAt`, `updatedAt`) included:
 * what a record view writes for its `$record.<field>`.
 */
export const recordTextsOf = (
  tables: TablesLike,
  table: string,
  row: Readonly<Record<string, unknown>>,
  context: ExportTextContext
): Readonly<Record<string, string>> => {
  const declared = tableOf(tables, table)
  if (declared === undefined) return {}
  const resolvers = resolversOf(tables, context)
  return Object.fromEntries(
    planFieldNamesOf(declared).flatMap((name) => {
      const plan = recordTextFieldOf(declared, name, resolvers)
      const value = row[name]
      return plan === undefined || value === undefined || value === null
        ? []
        : [[name, formatRecordText(value, plan, context.locale, context.now)] as const]
    })
  )
}

/**
 * A grid cell: its column's `format` when it names one, else its field type's
 * default, else `undefined`, and the cell is written as stored.
 */
export const cellTextOf = (
  tables: TablesLike,
  column: {
    readonly table: string | undefined
    readonly field: string
    readonly format?: unknown
  },
  row: Readonly<Record<string, unknown>>,
  context: ExportTextContext
): string | undefined => {
  const { table } = column
  const value = row[column.field]
  if (value === undefined || value === null || table === undefined) return undefined
  if (typeof column.format !== 'string')
    return recordTextsOf(tables, table, row, context)[column.field]
  // The served page's own options for an explicit format (`record-value-format.ts`),
  // the export's clock in place of the render's.
  const options = fieldFormatOptionsOf(
    tableOf(tables, table),
    column.field,
    resolversOf(tables, context)
  )
  return formatCellValue(value, column.format as ColumnFormat, context.locale, {
    ...options,
    ...(context.now === undefined ? {} : { now: context.now }),
  })
}
