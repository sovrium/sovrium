/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RECORD_TEXT_KEY } from '@/domain/models/app/pages/substitute-record-vars'
import {
  formatCellValue,
  type CellFormatOptions,
} from '@/domain/models/app/tables/cell-value-format'
import { fieldLiteralOf } from '@/domain/models/app/tables/checkbox-literal-service'
import { columnReadsAsDay, readDriverValue } from '@/domain/models/app/tables/driver-value-service'
import {
  fieldFormatOptionsOf,
  planFieldNamesOf,
  planFieldOf,
  planFieldTypeOf,
  recordTextFieldOf as planRecordTextFieldOf,
  type RecordTextResolvers,
} from '@/domain/models/app/tables/record-text-plan-service'
import {
  formatRecordText,
  type RecordTextField,
  type RecordTextFields,
} from '@/domain/models/app/tables/record-text-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { renderNow } from '@/presentation/render/page/render-clock'
import { optionLabelsOf } from '@/presentation/render/props/option-labels'
import { resolveValueCurrency } from './resolve-chart-field-context'
import type { Languages } from '@/domain/models/app/languages'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tables } from '@/domain/models/app/tables'

/**
 * How a record value READS on a page: a `record-field` given no `format`, a
 * `$record.<field>` token in page text, and the templates an island fills in the
 * browser all read their field type's default from ONE table
 * (`field-type-presentation-service.ts`), the same one the data grid's cells
 * read, so none of them can print one value two ways. The formatting itself is
 * the domain's (`record-text-service.ts`); this module resolves, per field, what
 * only the server knows: the zone, the currency, an option's translated label.
 */

type TableDefinition = Tables[number]

/** The page context a value is formatted in: the page's language, and the app's tables. */
export interface RecordTextContext {
  /** The page's language — the `<html lang>` it is served with. */
  readonly locale: string
  readonly tables: Tables | undefined
  /** The app's languages, for an option label written as a `$t:` key. */
  readonly languages?: Languages | undefined
}

/** What a field's text resolution reads beyond the table: the zone, the clock, the labels. */
interface FieldTextContext {
  /** The app's tables: a rollup reads the currency of the field it aggregates. */
  readonly tables: Tables | undefined
  readonly operatorZone: string
  readonly now: Readonly<Date>
  readonly locale: string
  readonly languages?: Languages | undefined
}

/** The resolvers the domain's plan builder reads a field with, on the server. */
const resolversOf = (context: FieldTextContext): RecordTextResolvers => ({
  locale: context.locale,
  timeZone: context.operatorZone,
  optionLabels: (field) =>
    optionLabelsOf(field, context.languages, { activeLang: context.locale, keepIdentical: true }),
  currencyOf: (table, fieldName) =>
    resolveValueCurrency(table as TableDefinition, fieldName, context.tables ?? []),
})

/** The format options a field is drawn with: the domain's, and the render's clock. */
const formatOptionsOf = (
  table: TableDefinition | undefined,
  fieldName: string | undefined,
  context: FieldTextContext
): CellFormatOptions => ({
  ...fieldFormatOptionsOf(table, fieldName, resolversOf(context)),
  now: context.now,
})

/**
 * How one field reads in a sentence when the author names no format, or
 * `undefined` when it prints as stored: the domain's plan, read on the server.
 */
const recordTextFieldOf = (
  table: TableDefinition | undefined,
  fieldName: string,
  context: FieldTextContext
): RecordTextField | undefined => planRecordTextFieldOf(table, fieldName, resolversOf(context))

/** The server's context for one resolution: the operator zone and the render's clock. */
const serverTextContext = (
  locale: string,
  languages: Languages | undefined,
  tables: Tables | undefined
): FieldTextContext => ({
  tables,
  operatorZone: parseSovriumTimezone().zoneId,
  now: renderNow(),
  locale,
  languages,
})

/**
 * A value printed as stored, when neither a format nor a field type applies:
 * empty for nothing, and a list's items joined the way `locale` joins a list
 * (`image/png, image/jpeg`) rather than run together by `String(array)`.
 */
export const storedValueText = (value: unknown, locale: string): string => {
  if (value === undefined || value === null) return ''
  if (!Array.isArray(value)) return String(value)
  const items = value.map((item: unknown) =>
    typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)
  )
  try {
    return new Intl.ListFormat(locale, { type: 'unit', style: 'short' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/**
 * A record value as it reads on a page, in `locale`: `format` when the author
 * named one, else the field type's default. `undefined` when neither applies,
 * so the caller prints the value as stored.
 */
export const formatRecordValue = (
  value: unknown,
  binding: {
    readonly table: TableDefinition | undefined
    readonly fieldName: string | undefined
    readonly format?: ColumnFormat | undefined
    readonly locale: string
    readonly languages?: Languages | undefined
    readonly tables?: Tables | undefined
  }
): string | undefined => {
  const context = serverTextContext(binding.locale, binding.languages, binding.tables)
  if (binding.format !== undefined) {
    const options = formatOptionsOf(binding.table, binding.fieldName, context)
    return formatCellValue(value, binding.format, binding.locale, options)
  }
  const field =
    binding.fieldName === undefined
      ? undefined
      : recordTextFieldOf(binding.table, binding.fieldName, context)
  return field === undefined
    ? undefined
    : formatRecordText(value, field, binding.locale, context.now)
}

/**
 * A value as the records API returns it: a driver `Date` by the API's own rule
 * ({@link readDriverValue}), a checkbox as a boolean on both engines.
 */
const storedValueOf = (value: unknown, plan: FieldTextPlan | undefined): unknown => {
  if (!(value instanceof Date)) return fieldLiteralOf(plan?.type, value)
  if (Number.isNaN(value.getTime())) return undefined
  return readDriverValue(value, plan?.day ?? plan?.type === 'date')
}

/** How one field of a table reads on a page: its type, whether it is a day, and its text. */
interface FieldTextPlan {
  readonly type: string | undefined
  readonly day?: boolean // {@link columnReadsAsDay}; absent when the table is unknown
  readonly text?: RecordTextField | undefined
}

/**
 * Every field of `table` — the system timestamps first, so a declared field of
 * the same name wins — with its type and, for a formatted one, how it reads.
 * Built ONCE per table per page render ({@link tablePlanOf}), so a list of rows
 * pays no field lookup, zone parse or label resolution per cell.
 */
const buildTablePlan = (
  table: TableDefinition,
  render: RecordTextContext
): ReadonlyMap<string, FieldTextPlan> => {
  const context = serverTextContext(render.locale, render.languages, render.tables)
  const schema = { app: { tables: render.tables ?? [table] }, tableName: table.name }
  return new Map(
    planFieldNamesOf(table).map((name) => {
      const type = planFieldTypeOf(planFieldOf(table, name), name)
      const day = columnReadsAsDay(schema, name)
      return [name, { type, day, text: recordTextFieldOf(table, name, context) }] as const
    })
  )
}

/** The plans built for one page render, by table name: a render is one context object. */
const TABLE_PLANS = new WeakMap<
  RecordTextContext,
  Map<string, ReadonlyMap<string, FieldTextPlan>>
>()

const tablePlanOf = (
  context: RecordTextContext,
  table: TableDefinition
): ReadonlyMap<string, FieldTextPlan> => {
  const plans = TABLE_PLANS.get(context) ?? new Map<string, ReadonlyMap<string, FieldTextPlan>>()
  const cached = plans.get(table.name)
  if (cached !== undefined) return cached
  const plan = buildTablePlan(table, context)
  // eslint-disable-next-line functional/immutable-data -- the memo writes ARE the per-render cache; a plan is a pure function of the table and the render's context
  TABLE_PLANS.set(context, plans.set(table.name, plan))
  return plan
}

/**
 * The text each relationship and `user` field of a record reads as: the labels
 * the records API gives this reader (`_display`) — a linked record by its
 * display field, a person by name, a to-many link's labels joined. A linked
 * record she may not read has no label, and its field keeps its stored id.
 */
const labelTextOf = (record: Readonly<Record<string, unknown>>): readonly [string, string][] => {
  const display = record['_display']
  if (display === null || typeof display !== 'object' || Array.isArray(display)) return []
  return Object.entries(display).flatMap(([field, label]): readonly [string, string][] => {
    const text = displayLabelText(label)
    return text === undefined ? [] : [[field, text]]
  })
}

/**
 * The text one `_display` label reads as: a label as it is, a to-many link's
 * labels joined, nothing for an empty list or anything else.
 */
export const displayLabelText = (label: unknown): string | undefined => {
  if (typeof label === 'string') return label
  return Array.isArray(label) && label.length > 0 ? label.map(String).join(', ') : undefined
}

/** The text a record already carries under `RECORD_TEXT_KEY` (a joined row's, say). */
export const recordTextEntriesOf = (
  record: Readonly<Record<string, unknown>>
): readonly [string, unknown][] => {
  const carried = record[RECORD_TEXT_KEY]
  return carried !== null && typeof carried === 'object' ? Object.entries(carried) : []
}

/**
 * A record read for a page, prepared for `$record.` substitution: every value
 * as the records API returns it, and — when the page context is known — each
 * formatted field's text under `RECORD_TEXT_KEY`, which a TEXT site prints and
 * an address site never reads: a date or an amount by its type, a relationship
 * or a person by its label ({@link labelTextOf}).
 *
 * A `null` value carries no text: it prints nothing either way.
 */
export const pageRecordOf = (
  record: Readonly<Record<string, unknown>>,
  tableName: string | undefined,
  context: RecordTextContext | undefined
): Record<string, unknown> => {
  const table = context?.tables?.find((candidate) => candidate.name === tableName)
  const plan =
    context === undefined || table === undefined ? undefined : tablePlanOf(context, table)
  const planOf = (key: string): FieldTextPlan | undefined =>
    plan === undefined ? { type: planFieldTypeOf(undefined, key) } : plan.get(key)
  const stored = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, storedValueOf(value, planOf(key))])
  )
  if (context === undefined || plan === undefined) return stored
  const now = renderNow()
  const formatted = Object.entries(stored).flatMap(([fieldName, value]) => {
    const field = plan.get(fieldName)?.text
    if (value === undefined || value === null || field === undefined) return []
    return [[fieldName, formatRecordText(value, field, context.locale, now)] as const]
  })
  const text = [...recordTextEntriesOf(stored), ...formatted, ...labelTextOf(stored)]
  return text.length === 0 ? stored : { ...stored, [RECORD_TEXT_KEY]: Object.fromEntries(text) }
}

/**
 * How every formatted field of a table reads, for an island that fills a
 * `$record.` template in the browser — a record drawer, a board's cards. Plain
 * data: the island formats with the domain's `withRecordTextFields` and the
 * page's `<html lang>`, and prints exactly what the server prints. `undefined`
 * when the table formats nothing, so the prop costs an unformatted table nothing.
 */
export const recordTextFieldsOf = (
  tables: Tables | undefined,
  tableName: string | undefined,
  context: { readonly locale: string; readonly languages?: Languages | undefined }
): RecordTextFields | undefined => {
  const table = tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return undefined
  const textContext = serverTextContext(context.locale, context.languages, tables)
  const fields = table.fields.flatMap((field) => {
    const text = recordTextFieldOf(table, field.name, textContext)
    return text === undefined ? [] : [[field.name, text] as const]
  })
  return fields.length === 0 ? undefined : Object.fromEntries(fields)
}

/**
 * An island's props carrying {@link recordTextFieldsOf} for the table its
 * `dataSource` names, under `recordText` — unchanged when that table formats
 * nothing, so a board over plain text fields ships exactly what it shipped.
 */
export const withRecordTextProp = (
  props: Readonly<Record<string, unknown>>,
  context: {
    readonly tables: Tables | undefined
    readonly languages: Languages | undefined
    readonly locale: string | undefined
  }
): Readonly<Record<string, unknown>> => {
  const table = (props['dataSource'] as { readonly table?: unknown } | undefined)?.table
  const recordText = recordTextFieldsOf(
    context.tables,
    typeof table === 'string' ? table : undefined,
    {
      locale: context.locale ?? 'en-US',
      languages: context.languages,
    }
  )
  return recordText === undefined ? props : { ...props, recordText }
}
