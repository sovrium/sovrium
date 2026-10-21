/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The columns of a migrated form's responses table: one per answerable
 * question (a question no longer in the form included, so its past answers are
 * kept), one per hidden field and one per computed variable.
 *
 * A question's type comes from its tool's question table
 * (`form-question-mappings.ts`); this file adds what the type needs to stand on
 * its own:
 *
 * - a choice question allowing several answers is a `multi-select`;
 * - a select lists the choices the form declares, then every other value a
 *   response holds (an "Other" answer), so no response is refused on seeding;
 *   a select with no choice at all is kept as text;
 * - a rating keeps its scale when the source states it.
 *
 * Column names are the question titles in `snake_case`, cut at a word boundary
 * so a long question still makes a readable column, and made unique.
 */

import { SOURCE_ID_FIELD } from './field-type-mappings'
import { lookupQuestion, type FormSourceTool } from './form-question-mappings'
import { toSnakeName, uniqueNames } from './import-names-service'
import { toolDisplayName } from './source-display-name-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'
import type { ConfigEntry } from './field-settings-service'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

type Question = CanonicalForm['questions'][number]

/** What a column holds. */
export type FormColumnRole = 'question' | 'retired' | 'hidden' | 'variable'

/** One column of a responses table. */
export interface FormColumn {
  /** The key the responses' values are read under: a question id, `hidden:<name>`, `variable:<name>`. */
  readonly key: string
  readonly role: FormColumnRole
  readonly name: string
  readonly label: string
  readonly sourceType: string
  readonly type: FieldType
  readonly settings: ConfigEntry
  readonly outcome: 'mapped' | 'degraded' | 'unmapped'
  readonly reason?: string
  readonly question?: Question
}

/** The longest column name a question title becomes, before numbering. */
const MAX_NAME = 40

/** Column names an import never takes: the row's own columns and `source_id`. */
const RESERVED: ReadonlySet<string> = new Set([
  SOURCE_ID_FIELD,
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
])

/** A label as a column name, cut at the last word boundary within the limit. */
export const columnNameOf = (label: string, fallback = 'answer'): string => {
  const snake = toSnakeName(label, fallback)
  if (snake.length <= MAX_NAME) return snake
  const cut = snake.slice(0, MAX_NAME)
  const boundary = cut.lastIndexOf('_')
  return boundary > 0 ? cut.slice(0, boundary) : cut
}

/** The key a hidden field's values are read under. */
export const hiddenKey = (name: string): string => `hidden:${name}`

/** The key a variable's values are read under. */
export const variableKey = (name: string): string => `variable:${name}`

/** Every value one key holds across the responses, absent ones left out. */
const valuesOf = (form: CanonicalForm, key: string): readonly CanonicalValue[] =>
  form.responses.flatMap((response) => {
    const value = response.answers[key]
    return value === undefined ? [] : [value]
  })

const SELECTS: ReadonlySet<FieldType> = new Set<FieldType>(['single-select', 'multi-select'])

/** The choices declared, then every other text value a response picked. */
const selectOptions = (
  question: Question,
  values: readonly CanonicalValue[]
): readonly string[] => {
  const declared = (question.choices ?? []).map((choice) => choice.label.trim())
  const picked = values.flatMap((value) => (Array.isArray(value) ? value : [value]))
  const extra = picked.filter((value): value is string => typeof value === 'string')
  return [...new Set([...declared, ...extra.map((value) => value.trim())])].filter(
    (option) => option !== ''
  )
}

/** A rating's scale, when the source states one Sovrium has (1 to 10). */
const ratingSettings = (question: Question): ConfigEntry => {
  const steps = question.properties?.['steps'] ?? question.properties?.['max']
  return typeof steps === 'number' && Number.isInteger(steps) && steps >= 1 && steps <= 10
    ? { max: steps }
    : {}
}

interface Decision {
  readonly type: FieldType
  readonly settings: ConfigEntry
  readonly outcome: FormColumn['outcome']
  readonly reason?: string
}

/** What one answerable question becomes. */
const decideQuestion = (
  tool: FormSourceTool,
  form: CanonicalForm,
  question: Question
): Decision => {
  const lookup = lookupQuestion(tool, question.sourceType)
  if (lookup.outcome === 'structural') return { type: 'long-text', settings: {}, outcome: 'mapped' }
  if (lookup.outcome === 'unmapped') {
    return {
      type: lookup.sovrium,
      settings: {},
      outcome: 'unmapped',
      reason: `No Sovrium form field answers a ${toolDisplayName(tool)} "${question.sourceType}" question; each answer is kept as text.`,
    }
  }
  const base: Decision =
    lookup.outcome === 'degraded'
      ? { type: lookup.sovrium, settings: {}, outcome: 'degraded', reason: lookup.reason }
      : { type: lookup.sovrium, settings: {}, outcome: 'mapped' }
  const type: FieldType =
    base.type === 'single-select' && question.allowMultiple === true ? 'multi-select' : base.type
  if (SELECTS.has(type)) {
    const options = selectOptions(question, valuesOf(form, question.sourceId))
    return options.length > 0
      ? { ...base, type, settings: { options } }
      : {
          type: 'single-line-text',
          settings: {},
          outcome: 'degraded',
          reason:
            'The source states no choice and no response picked one, so the answers are kept as text.',
        }
  }
  return type === 'rating' ? { ...base, settings: ratingSettings(question) } : { ...base, type }
}

/** Whether a question is an answer rather than layout. */
export const isAnswerable = (tool: FormSourceTool, question: Question): boolean =>
  lookupQuestion(tool, question.sourceType).outcome !== 'structural'

/** The columns of a form's responses table, in reading order. */
export const planFormColumns = (form: CanonicalForm): readonly FormColumn[] => {
  const tool = form.tool as FormSourceTool
  const answerable = form.questions.filter((question) => isAnswerable(tool, question))
  const ordered = [
    ...answerable.filter((question) => question.retired !== true),
    ...answerable.filter((question) => question.retired === true),
  ]
  const drafts = [
    ...ordered.map((question) => ({
      key: question.sourceId,
      role: (question.retired === true ? 'retired' : 'question') as FormColumnRole,
      label: question.title.trim() === '' ? question.sourceType : question.title.trim(),
      sourceType: question.sourceType,
      decision: decideQuestion(tool, form, question),
      question,
    })),
    ...form.hiddenFields.map((name) => ({
      key: hiddenKey(name),
      role: 'hidden' as FormColumnRole,
      label: name,
      sourceType: 'hidden field',
      decision: { type: 'single-line-text', settings: {}, outcome: 'mapped' } as Decision,
      question: undefined,
    })),
    ...(form.variables ?? []).map((variable) => ({
      key: variableKey(variable.name),
      role: 'variable' as FormColumnRole,
      label: variable.name,
      sourceType: 'variable',
      decision: {
        type: variable.kind === 'text' ? 'single-line-text' : 'decimal',
        settings: {},
        outcome: 'mapped',
      } as Decision,
      question: undefined,
    })),
  ]
  const names = uniqueNames(
    drafts.map((draft) => columnNameOf(draft.label)),
    'snake',
    RESERVED
  )
  return drafts.map((draft, index) => ({
    key: draft.key,
    role: draft.role,
    name: names[index] ?? 'answer',
    label: draft.label,
    sourceType: draft.sourceType,
    type: draft.decision.type,
    settings: draft.decision.settings,
    outcome: draft.decision.outcome,
    ...(draft.decision.reason === undefined ? {} : { reason: draft.decision.reason }),
    ...(draft.question === undefined ? {} : { question: draft.question }),
  }))
}
