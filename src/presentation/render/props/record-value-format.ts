/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RECORD_TEXT_KEY } from '@/domain/models/app/pages/substitute-record-vars'
import {
  dateTimeGlueOf,
  formatCellValue,
  type CellFormatOptions,
} from '@/domain/models/app/tables/cell-value-format'
import { fieldLiteralOf } from '@/domain/models/app/tables/checkbox-literal-service'
import {
  formatRecordText,
  type RecordTextField,
  type RecordTextFields,
} from '@/domain/models/app/tables/record-text-service'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { readColumnOptions } from '@/presentation/render/forms/form-field-resolver'
import { resolveValueCurrency } from './resolve-chart-field-context'
import type { DurationDisplayFormat } from '@/domain/kernel/format/duration-format'
import type { Languages } from '@/domain/models/app/languages'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tables } from '@/domain/models/app/tables'

/**
 * How a record value READS on a page — ONE table, shared by a `record-field`
 * given no `format`, a `$record.<field>` token in page text, and the templates
 * an island fills in the browser, so none of them can print one value two ways.
 *
 * Only these types are formatted, plus a rollup that is money
 * ({@link defaultFormatOf}); every other prints as stored. A `number`,
 * `integer` or `decimal` in particular stays as stored: a year, a reference or a
 * quantity printed with grouping (`2,026`) is wrong. The formatting itself is
 * the domain's (`record-text-service.ts`); this module resolves, per field, what
 * only the server knows — the zone, the currency, an option's translated label.
 */
const FORMAT_BY_FIELD_TYPE: Readonly<Record<string, RecordTextField['format']>> = {
  currency: 'currency',
  date: 'short-date',
  datetime: 'datetime',
  'created-at': 'datetime',
  'updated-at': 'datetime',
  percentage: 'percent',
  checkbox: 'yes-no',
  'single-select': 'option',
  status: 'option',
  'multi-select': 'options',
  duration: 'duration',
}

/**
 * The system timestamps, by the name the records API gives them: a record
 * carries them whether or not the table declares a field for them.
 */
const SYSTEM_TIMESTAMP_TYPES: Readonly<Record<string, string>> = {
  createdAt: 'created-at',
  updatedAt: 'updated-at',
}

type TableDefinition = Tables[number]
type TableField = TableDefinition['fields'][number]

/** The page context a value is formatted in: the page's language, and the app's tables. */
export interface RecordTextContext {
  /** The page's language — the `<html lang>` it is served with. */
  readonly locale: string
  readonly tables: Tables | undefined
  /** The app's languages, for an option label written as a `$t:` key. */
  readonly languages?: Languages | undefined
}

const fieldOf = (
  table: TableDefinition | undefined,
  fieldName: string | undefined
): TableField | undefined =>
  fieldName === undefined ? undefined : table?.fields.find((field) => field.name === fieldName)

/** The type a field reads as: its declared type, else a system timestamp's. */
const fieldTypeOf = (field: TableField | undefined, fieldName: string | undefined) =>
  field?.type ?? (fieldName === undefined ? undefined : SYSTEM_TIMESTAMP_TYPES[fieldName])

/**
 * The zone a value is drawn in. A `date` has no time and no zone, so its day is
 * read in UTC — whoever reads it, it is the same day. A `datetime` declaring its
 * own `timeZone` is drawn there, as the grid draws it; `local` (the reader's
 * zone, which the server does not know) and every other value read in the
 * operator time zone.
 */
const zoneOf = (
  field: TableField | undefined,
  fieldType: string | undefined,
  operatorZone: string
): string => {
  if (fieldType === 'date') return 'UTC'
  const declared = (field as { readonly timeZone?: unknown } | undefined)?.timeZone
  return typeof declared === 'string' && declared !== '' && declared !== 'local'
    ? declared
    : operatorZone
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

/** The format options a field is drawn with: its zone, the render's clock, its currency. */
const formatOptionsOf = (
  table: TableDefinition | undefined,
  fieldName: string | undefined,
  context: Pick<FieldTextContext, 'operatorZone' | 'now' | 'tables'>
): CellFormatOptions => {
  const field = fieldOf(table, fieldName)
  const currency =
    table === undefined ? undefined : resolveValueCurrency(table, fieldName, context.tables ?? [])
  return {
    timeZone: zoneOf(field, fieldTypeOf(field, fieldName), context.operatorZone),
    now: context.now,
    ...(currency === undefined ? {} : { currency }),
  }
}

/** An option field's labels, stored value → the label read in the page's language. */
const optionLabelsOf = (
  field: TableField | undefined,
  context: FieldTextContext
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    (readColumnOptions(field, context.languages, context.locale) ?? []).map(
      (option) => [option.value, option.label] as const
    )
  )

/** A field's own display setting, read off its definition. */
const declared = <T>(field: TableField | undefined, key: string): T | undefined =>
  (field as Readonly<Record<string, unknown>> | undefined)?.[key] as T | undefined

/** A field read through a grid column format: its zone, its currency, a date-time's glue. */
const cellTextFieldOf = (
  table: TableDefinition | undefined,
  fieldName: string,
  format: ColumnFormat,
  context: FieldTextContext
): RecordTextField => {
  const { timeZone, currency } = formatOptionsOf(table, fieldName, context)
  const glue = format === 'datetime' ? dateTimeGlueOf(context.locale) : undefined
  // Only a date reads a zone: the prop an island receives carries nothing else.
  const dated = format === 'short-date' || format === 'datetime'
  return {
    format,
    ...(dated && timeZone !== undefined ? { timeZone } : {}),
    ...(currency && { currency }),
    ...(glue === undefined ? {} : { glue }),
  }
}

/**
 * The format a field reads in by default: its type's, else `currency` for a
 * rollup that is money — one summing, averaging or picking an extreme of a
 * `currency` field, or declaring a code of its own — exactly when the grid and
 * `?format=display` print it as money.
 */
const defaultFormatOf = (
  table: TableDefinition | undefined,
  field: TableField | undefined,
  fieldName: string,
  context: Pick<FieldTextContext, 'tables'>
): RecordTextField['format'] | undefined => {
  const byType = FORMAT_BY_FIELD_TYPE[fieldTypeOf(field, fieldName) ?? '']
  if (byType !== undefined || field?.type !== 'rollup' || table === undefined) return byType
  const money = resolveValueCurrency(table, fieldName, context.tables ?? [])
  return money?.currency === undefined ? undefined : 'currency'
}

/**
 * How one field reads in a sentence when the author names no format, or
 * `undefined` when it prints as stored.
 */
const recordTextFieldOf = (
  table: TableDefinition | undefined,
  fieldName: string,
  context: FieldTextContext
): RecordTextField | undefined => {
  const field = fieldOf(table, fieldName)
  const format = defaultFormatOf(table, field, fieldName, context)
  if (format === undefined) return undefined
  if (format === 'percent') return { format, precision: declared<number>(field, 'precision') }
  if (format === 'option' || format === 'options') {
    return { format, labels: optionLabelsOf(field, context) }
  }
  if (format === 'duration') {
    return { format, displayFormat: declared<DurationDisplayFormat>(field, 'displayFormat') }
  }
  return cellTextFieldOf(table, fieldName, format, context)
}

/** The server's context for one resolution: the operator zone and the render's clock. */
const serverTextContext = (
  locale: string,
  languages: Languages | undefined,
  tables: Tables | undefined
): FieldTextContext => ({
  tables,
  operatorZone: parseSovriumTimezone().zoneId,
  now: serverNow(),
  locale,
  languages,
})

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
 * A value as the records API returns it: a `Date` the driver decoded as a `date`
 * field's day (`YYYY-MM-DD`) or else its ISO 8601 instant (SQLite text passes
 * through), and a checkbox as a boolean on both engines (SQLite stores `1`).
 */
const storedValueOf = (value: unknown, fieldType: string | undefined): unknown => {
  if (!(value instanceof Date)) return fieldLiteralOf(fieldType, value)
  if (Number.isNaN(value.getTime())) return undefined
  return fieldType === 'date' ? value.toISOString().slice(0, 10) : value.toISOString()
}

/** How one field of a table reads on a page: its type, and its text when it is formatted. */
interface FieldTextPlan {
  readonly type: string | undefined
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
  context: FieldTextContext
): ReadonlyMap<string, FieldTextPlan> => {
  const names = [...Object.keys(SYSTEM_TIMESTAMP_TYPES), ...table.fields.map((f) => f.name)]
  return new Map(
    names.map((name) => {
      const type = fieldTypeOf(fieldOf(table, name), name)
      return [name, { type, text: recordTextFieldOf(table, name, context) }] as const
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
  const plan = buildTablePlan(
    table,
    serverTextContext(context.locale, context.languages, context.tables)
  )
  // eslint-disable-next-line functional/immutable-data -- the memo writes ARE the per-render cache; a plan is a pure function of the table and the render's context
  TABLE_PLANS.set(context, plans.set(table.name, plan))
  return plan
}

/**
 * A record read for a page, prepared for `$record.` substitution: every value
 * as the records API returns it, and — when the page context is known — each
 * formatted field's text under `RECORD_TEXT_KEY`, which a TEXT site prints and
 * an address site never reads.
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
  const typeOf = (key: string) =>
    plan === undefined ? fieldTypeOf(undefined, key) : plan.get(key)?.type
  const stored = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, storedValueOf(value, typeOf(key))])
  )
  if (context === undefined || plan === undefined) return stored
  const now = serverNow()
  const text = Object.entries(stored).flatMap(([fieldName, value]) => {
    const field = plan.get(fieldName)?.text
    if (value === undefined || value === null || field === undefined) return []
    return [[fieldName, formatRecordText(value, field, context.locale, now)] as const]
  })
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
