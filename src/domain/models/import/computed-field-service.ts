/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Formula and rollup fields: translated when they can be, kept as values when not.
 *
 * - A formula from a dialect with a parser (Airtable, Notion) goes through
 *   `translateFormula`. Translated, it is a Sovrium `formula` field with its
 *   `resultType`; a translation with notes is reported `degraded`, the notes
 *   saying what differs.
 * - A rollup becomes a Sovrium `rollup` when its relation was imported as a
 *   relationship, the field it reads was imported, and its aggregation is
 *   stated in a way the rollup table maps.
 * - Anything else becomes a plain field of the formula's RESULT type (a
 *   number formula stays a number column), holding the values the source last
 *   computed, plus a TODO quoting the original. The data stays right; only
 *   the live calculation is dropped, and the report says so.
 */

import { lookupFieldType } from './field-type-mappings'
import {
  quoteOriginalFormula,
  translateFormula,
  formulaFieldMap,
} from './formula-translation-service'
import { linkTargetOf } from './link-pairing-service'
import { inferRollupAggregation } from './rollup-aggregation-mappings'
import { toolDisplayName } from './source-display-name-service'
import type { CanonicalField } from './canonical-base'
import type { TableSourceTool } from './field-type-mappings'
import type { FormulaDialect } from './formula-ast'
import type { FormulaFieldSource } from './formula-translation-service'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** What one formula or rollup field becomes. */
export interface ComputedFieldPlan {
  readonly type: FieldType
  readonly outcome: 'mapped' | 'degraded'
  readonly reason?: string
  /** The settings the field's entry carries beyond its name and type. */
  readonly settings: Readonly<Record<string, unknown>>
  /** For a field kept as values, the options its type's settings read (a currency symbol). */
  readonly valueOptions?: Readonly<Record<string, unknown>>
  /** For a field kept as values, what the report's TODO quotes and why. */
  readonly todo?: { readonly original: string; readonly reason: string }
}

/** Everything planning one computed field needs from the table mapper. */
export interface ComputedFieldInput {
  readonly tool: TableSourceTool
  readonly field: CanonicalField
  /** Every field of the same table: ids, names and the type each was given. */
  readonly siblings: readonly FormulaFieldSource[]
  /** The Sovrium name of a field of the table a link field points at. */
  readonly linkedFieldName: (linkFieldId: string, fieldId: string) => string | undefined
}

/** The source types a computed field is planned for, by the Sovrium type they map to. */
export const isComputedField = (tool: TableSourceTool, field: CanonicalField): boolean => {
  const target = lookupFieldType(tool, field.sourceType).sovrium
  return target === 'formula' || target === 'rollup'
}

/** The plain types a field kept as values may take; any other result is kept as text. */
const VALUE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
  'number',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'duration',
  'checkbox',
  'date',
  'datetime',
])

/** Notion states a formula's result as its value's type. */
const NOTION_RESULTS: Readonly<Record<string, FieldType>> = {
  string: 'single-line-text',
  number: 'number',
  boolean: 'checkbox',
  date: 'datetime',
}

const record = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

/** The result type's name: Airtable's `result.type`, or an adapter's `resultType`. */
const resultName = (
  field: CanonicalField,
  result: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  const named = result?.['type'] ?? field.options?.['resultType']
  return typeof named === 'string' ? named : undefined
}

/** The result the source declares: Airtable's `options.result`, or an adapter's `resultType`. */
const declaredResult = (
  tool: TableSourceTool,
  field: CanonicalField
): { readonly type: FieldType; readonly options?: Readonly<Record<string, unknown>> } => {
  const result = record(field.options?.['result'])
  const named = resultName(field, result)
  if (named === undefined) return { type: 'long-text' }
  const notion = tool === 'notion' ? NOTION_RESULTS[named] : undefined
  if (notion !== undefined) return { type: notion }
  const looked = lookupFieldType(tool, named)
  if (looked.outcome === 'unmapped' || !VALUE_TYPES.has(looked.sovrium))
    return { type: 'long-text' }
  const options = record(result?.['options'])
  return options === undefined ? { type: looked.sovrium } : { type: looked.sovrium, options }
}

/**
 * The plain type a computed field's value has when its source declares one a
 * formula can read (Airtable's `options.result.type` on a lookup); `undefined`
 * when the source declares none, or one that is not a plain value.
 */
export const declaredValueType = (
  tool: TableSourceTool,
  field: CanonicalField
): FieldType | undefined => {
  const named = resultName(field, record(field.options?.['result']))
  if (named === undefined) return undefined
  const notion = tool === 'notion' ? NOTION_RESULTS[named] : undefined
  if (notion !== undefined) return notion
  const looked = lookupFieldType(tool, named)
  return looked.outcome !== 'unmapped' && VALUE_TYPES.has(looked.sovrium)
    ? looked.sovrium
    : undefined
}

/**
 * The type a formula or rollup field's VALUES have: its declared result type.
 *
 * Used for the field when it is kept as values, and by a formula that
 * references it, whichever way it lands.
 */
export const computedValueType = (tool: TableSourceTool, field: CanonicalField): FieldType =>
  declaredResult(tool, field).type

const DIALECTS: Readonly<Partial<Record<TableSourceTool, FormulaDialect>>> = {
  airtable: 'airtable',
  notion: 'notion',
}

const keptAsValues = (
  input: ComputedFieldInput,
  original: string,
  reason: string
): ComputedFieldPlan => {
  const result = declaredResult(input.tool, input.field)
  return {
    type: result.type,
    outcome: 'degraded',
    reason: `Kept as its last computed values: ${reason}`,
    settings: {},
    ...(result.options === undefined ? {} : { valueOptions: result.options }),
    todo: { original, reason },
  }
}

/** A translated field: `mapped`, or `degraded` with what differs. */
const translated = (
  type: 'formula' | 'rollup',
  settings: Readonly<Record<string, unknown>>,
  notes: readonly string[]
): ComputedFieldPlan =>
  notes.length === 0
    ? { type, outcome: 'mapped', settings }
    : { type, outcome: 'degraded', reason: notes.join('; '), settings }

/** The formula text the source exposes: Airtable's `formula`, Notion's `expression`. */
const formulaText = (field: CanonicalField): string => {
  const source = field.options?.['formula'] ?? field.options?.['expression']
  return typeof source === 'string' ? source : ''
}

/** Why a formula is not even tried, when it is not. */
const untranslatable = (field: CanonicalField, text: string): string | undefined => {
  if (text === '') return 'The source does not expose the formula text'
  return field.options?.['isValid'] === false
    ? 'The source reports the formula as invalid'
    : undefined
}

const planFormula = (input: ComputedFieldInput): ComputedFieldPlan => {
  const text = formulaText(input.field)
  const dialect = DIALECTS[input.tool]
  if (dialect === undefined) {
    return keptAsValues(
      input,
      text,
      `Formulas from ${toolDisplayName(input.tool)} are not translated`
    )
  }
  const fields = formulaFieldMap(input.siblings)
  const original = quoteOriginalFormula(dialect, text, fields)
  const refusal = untranslatable(input.field, text)
  if (refusal !== undefined) return keptAsValues(input, original, refusal)
  const result = translateFormula(dialect, text, fields)
  return result.ok
    ? translated(
        'formula',
        { formula: result.formula, resultType: result.resultType },
        result.notes
      )
    : keptAsValues(input, original, result.reason)
}

/** The ids of a rollup's link field and the linked field it reads, in either source's words. */
const rollupIds = (
  options: Readonly<Record<string, unknown>> | undefined
): { readonly link?: string; readonly related?: string } => {
  const link = options?.['recordLinkFieldId'] ?? options?.['relation_property_id']
  const related = options?.['fieldIdInLinkedTable'] ?? options?.['rollup_property_id']
  return {
    ...(typeof link === 'string' ? { link } : {}),
    ...(typeof related === 'string' ? { related } : {}),
  }
}

/** The Sovrium name of the field a rollup reads in the linked table. */
const relatedFieldName = (
  input: ComputedFieldInput,
  ids: { readonly link?: string; readonly related?: string }
): string | undefined =>
  ids.link === undefined || ids.related === undefined
    ? undefined
    : input.linkedFieldName(ids.link, ids.related)

/** A rollup as the report quotes it: `rollup(<link>, <field>[, <aggregation>])`. */
const rollupQuote = (parts: readonly (string | undefined)[]): string =>
  `rollup(${parts.filter((part) => part !== undefined && part !== '').join(', ')})`

const planRollup = (input: ComputedFieldInput): ComputedFieldPlan => {
  const ids = rollupIds(input.field.options)
  const link = input.siblings.find((sibling) => sibling.sourceId === ids.link)
  const related = relatedFieldName(input, ids)
  const aggregation = inferRollupAggregation(input.tool, input.field.options)
  const original = rollupQuote([
    link?.label ?? ids.link,
    related ?? ids.related,
    aggregation.source,
  ])
  if (aggregation.outcome !== 'mapped') return keptAsValues(input, original, aggregation.reason)
  if (link?.type !== 'relationship' || related === undefined) {
    return keptAsValues(
      input,
      original,
      'The link field or the linked field it reads was not imported as a relationship'
    )
  }
  return translated(
    'rollup',
    { relationshipField: link.name, relatedField: related, aggregation: aggregation.aggregation },
    aggregation.note === undefined ? [] : [aggregation.note]
  )
}

/** Plan one formula or rollup field. */
export const planComputedField = (input: ComputedFieldInput): ComputedFieldPlan =>
  lookupFieldType(input.tool, input.field.sourceType).sovrium === 'rollup'
    ? planRollup(input)
    : planFormula(input)

/** A mapper row a computed field is planned on: the source field, its name and its type. */
export interface ComputedRow {
  readonly field: CanonicalField
  readonly name: string
  readonly type: FieldType
  readonly outcome: 'mapped' | 'degraded' | 'unmapped'
  readonly reason?: string
  readonly plan?: ComputedFieldPlan
}

/**
 * Plan every formula and rollup of a table, over its other fields as typed.
 *
 * `fieldName` resolves a field of another table by table and field source id,
 * for a rollup that reads through a link (its target as `linkTargetOf` reads it).
 */
export const planComputedRows = <R extends ComputedRow>(
  tool: TableSourceTool,
  rows: readonly R[],
  fieldName: (tableId: string, fieldId: string) => string | undefined
): readonly R[] => {
  const siblings = rows.map((row) => ({
    sourceId: row.field.sourceId,
    label: row.field.name,
    name: row.name,
    type: row.type,
  }))
  const linkedFieldName = (linkFieldId: string, fieldId: string): string | undefined => {
    const link = rows.find((row) => row.field.sourceId === linkFieldId)?.field
    const tableId = link === undefined ? undefined : linkTargetOf(link)
    return tableId === undefined ? undefined : fieldName(tableId, fieldId)
  }
  return rows.map((row) => {
    if (!isComputedField(tool, row.field)) return row
    const plan = planComputedField({ tool, field: row.field, siblings, linkedFieldName })
    const { reason: _replaced, ...rest } = row
    return {
      ...rest,
      type: plan.type,
      outcome: plan.outcome,
      ...(plan.reason === undefined ? {} : { reason: plan.reason }),
      plan,
    } as R
  })
}
