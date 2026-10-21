/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Translate one source formula into a Sovrium formula, or say why not.
 *
 * Parse with the dialect's grammar, emit through the dialect's function table,
 * then run the result through Sovrium's own formula check, the one a config is
 * validated with. Only text that passes all three is returned: a translation
 * the config would refuse is no translation.
 *
 * This is the entry point a source adapter calls. Everything it needs is in
 * the field map: for each key the source may use to name a field (its id and
 * its name), the Sovrium field it became and that field's type.
 */

import { validateFormulaFields } from '@/domain/models/app/tables/table-formula-validation'
import { SOURCE_ID_FIELD } from './field-type-mappings'
import { emitFormula, type FormulaResultType } from './formula-emitter-service'
import { parseFormula } from './formula-parser-service'
import type { FormulaDialect } from './formula-ast'
import type { FormulaFieldMap, FormulaFieldTarget } from './formula-emit-primitives-service'
import type { FormulaValueType } from './formula-function-mappings'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

export type { FormulaFieldMap } from './formula-emit-primitives-service'

/** What translating one formula produced. */
export type FormulaTranslation =
  | {
      readonly ok: true
      /** The Sovrium formula text. */
      readonly formula: string
      /** The formula field's `resultType`. */
      readonly resultType: FormulaResultType
      /** What differs at the edges; empty when the translation is exact. */
      readonly notes: readonly string[]
    }
  | {
      readonly ok: false
      /** `degraded`: close only on PostgreSQL or only approximately; `unsupported`: no counterpart. */
      readonly outcome: 'degraded' | 'unsupported'
      readonly reason: string
    }

const VALUE_TYPES: Readonly<Partial<Record<FieldType, FormulaValueType>>> = {
  'single-line-text': 'text',
  'long-text': 'text',
  'rich-text': 'text',
  email: 'text',
  url: 'text',
  'phone-number': 'text',
  'single-select': 'text',
  status: 'text',
  barcode: 'text',
  color: 'text',
  code: 'text',
  integer: 'number',
  decimal: 'number',
  number: 'number',
  currency: 'number',
  percentage: 'number',
  rating: 'number',
  progress: 'number',
  duration: 'number',
  autonumber: 'number',
  count: 'number',
  checkbox: 'boolean',
  date: 'date',
  datetime: 'datetime',
  'created-at': 'datetime',
  'updated-at': 'datetime',
}

const RESULT_VALUE_TYPES: Readonly<Record<string, FormulaValueType>> = {
  number: 'number',
  integer: 'number',
  decimal: 'number',
  text: 'text',
  string: 'text',
  boolean: 'boolean',
  date: 'date',
  datetime: 'datetime',
}

/**
 * The static type a field's values have inside a formula.
 *
 * A formula field reads as its `resultType`; a lookup through a link to one
 * record reads as the plain type of the value it looks up (`valueType`); a
 * field whose values a formula cannot use as one scalar (a link, a list, a
 * person, a file) is `unknown`, and any operator that needs to know refuses it.
 */
export const formulaValueTypeOf = (
  type: FieldType,
  resultType?: string,
  valueType?: FieldType
): FormulaValueType => {
  if (type === 'formula' || type === 'rollup')
    return RESULT_VALUE_TYPES[resultType ?? ''] ?? 'unknown'
  if (type === 'lookup' && valueType !== undefined) return VALUE_TYPES[valueType] ?? 'unknown'
  return VALUE_TYPES[type] ?? 'unknown'
}

/** One field as an adapter knows it, for building a field map. */
export interface FormulaFieldSource {
  /** The field's id in the source. */
  readonly sourceId: string
  /** The field's name in the source. */
  readonly label: string
  /** Its Sovrium name. */
  readonly name: string
  /** Its Sovrium type. */
  readonly type: FieldType
  /** For a formula or rollup field, its result type. */
  readonly resultType?: string
  /** For a lookup through a link to one record, the plain type of the value it looks up. */
  readonly valueType?: FieldType
}

/**
 * A field map keyed by both id and name, the forms a source formula may use.
 *
 * An id wins over a name that happens to spell it, because the APIs return ids.
 */
export const formulaFieldMap = (fields: readonly FormulaFieldSource[]): FormulaFieldMap => {
  const target = (field: FormulaFieldSource): FormulaFieldTarget => ({
    name: field.name,
    label: field.label,
    type: formulaValueTypeOf(field.type, field.resultType, field.valueType),
    fieldType: field.type,
  })
  return new Map([
    ...fields.map((field) => [field.label, target(field)] as const),
    ...fields.map((field) => [field.sourceId, target(field)] as const),
  ])
}

/** The name the candidate formula takes in the validation pass; never a field name. */
const CANDIDATE = 'imported_formula_candidate'

/**
 * Run the emitted text through the formula check a config is validated with,
 * over the table's fields and the `source_id` column every imported table gains.
 */
const checkWithSovrium = (formula: string, fields: FormulaFieldMap): string | undefined => {
  const names = [...new Set([...[...fields.values()].map((field) => field.name), SOURCE_ID_FIELD])]
  const refusal = validateFormulaFields([
    ...names.map((name) => ({ name, type: 'single-line-text' })),
    { name: CANDIDATE, type: 'formula', formula },
  ])
  return refusal?.message
}

/**
 * Translate one formula of a source dialect into Sovrium formula text.
 *
 * Deterministic (the same input gives the same bytes) and total: it never
 * throws, and a formula it cannot translate is `{ ok: false }` with the
 * outcome and a sentence saying why.
 */
export const translateFormula = (
  dialect: FormulaDialect,
  source: string,
  fields: FormulaFieldMap
): FormulaTranslation => {
  const parsed = parseFormula(dialect, source)
  if (!parsed.ok) return { ok: false, outcome: 'unsupported', reason: parsed.reason }
  const emitted = emitFormula(dialect, parsed.node, fields)
  if (!emitted.ok) return emitted
  const refusal = checkWithSovrium(emitted.formula, fields)
  if (refusal !== undefined) {
    return {
      ok: false,
      outcome: 'unsupported',
      reason: `Sovrium's formula check refuses the translation: ${refusal}`,
    }
  }
  return {
    ok: true,
    formula: emitted.formula,
    resultType: emitted.type,
    notes: emitted.notes,
  }
}

const REFERENCES =
  /"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|\{\{notion:block_property:([^:}]+)[^}]*\}\}|\{([^{}]+)\}/g

/**
 * The formula as its author wrote it: field ids replaced by field names.
 *
 * The APIs return `{fldXXXXXXXXXXXXXX}` and `{{notion:block_property:…}}`
 * where the editor shows `{Name}` and `prop("Name")`; the report quotes the
 * editor's form, so the reader recognises the formula. Strings are left alone.
 */
export const quoteOriginalFormula = (
  dialect: FormulaDialect,
  source: string,
  fields: FormulaFieldMap
): string =>
  source.replace(REFERENCES, (match, notionId?: string, braced?: string) => {
    if (notionId !== undefined && dialect === 'notion') {
      const label = fields.get(notionId)?.label
      return label === undefined ? match : `prop(${JSON.stringify(label)})`
    }
    if (braced !== undefined && dialect === 'airtable') {
      const label = fields.get(braced)?.label
      return label === undefined ? match : `{${label}}`
    }
    return match
  })
