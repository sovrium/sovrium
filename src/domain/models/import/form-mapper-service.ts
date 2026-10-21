/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE form mapper: `CanonicalForm`s in, `forms[]` and `tables[]` entries
 * out, with the responses ready for the seed path.
 *
 * Every imported form is TABLE-BOUND. Its questions become the columns of a
 * generated `<form>_responses` table (`form-columns-service`), and its fields
 * are `table-field` entries naming them, so validation and storage follow from
 * each column exactly as for a form written by hand. Its responses become
 * records of that table, keyed and merged on `source_id` like any imported
 * table, so the seed writer is the data path's own.
 *
 * - pages and groups become `steps` (a multi-step layout);
 * - statements and headings become `section` fields;
 * - jumps, show and hide rules become `visibleWhen`, a require rule
 *   `requiredWhen` (`form-logic-service`), and a branch taken on leaving a
 *   page a step's `goToWhen` (`form-branch-service`); what does not translate
 *   is a TODO;
 * - hidden fields become hidden fields filled from the link (`prefill`);
 * - a variable becomes a column holding the values the source computed, and a
 *   `calculation` field when its steps translate;
 * - the thank-you screen becomes `onSuccess`.
 */

import { SOURCE_ID_FIELD } from './field-type-mappings'
import { planFormBranches, type FormBranches } from './form-branch-service'
import {
  hiddenKey,
  isAnswerable,
  planFormColumns,
  variableKey,
  type FormColumn,
} from './form-columns-service'
import { toVisibleWhen } from './form-condition-service'
import { planFormLogic, type FormLogic } from './form-logic-service'
import { RESPONSES_TABLE_SUFFIX, type FormSourceTool } from './form-question-mappings'
import { formTableOf } from './form-table-service'
import { prefixedName, toKebabName, uniqueNames } from './import-names-service'
import type { CanonicalForm } from './canonical-form'
import type { ConfigEntry } from './field-settings-service'
import type { ImportReport } from './import-report'
import type { MappedTable } from './table-mapper-service'

type Unmapped = ImportReport['unmapped'][number]
type Todo = ImportReport['todo'][number]
type FormsSection = NonNullable<ImportReport['forms']>
type TableFields = NonNullable<ImportReport['tables']>['fields']

/** What the config already holds, so new names and ids never collide. */
export interface FormMappingContext {
  readonly prefix?: string
  readonly maxTableId: number
  readonly maxFormId: number
}

/** The mapper's whole result. */
export interface FormPlan {
  readonly forms: readonly ConfigEntry[]
  readonly tables: readonly MappedTable[]
  readonly section: FormsSection
  /** How each column of the responses tables was typed, for the report's tables section. */
  readonly fields: TableFields
  readonly unmapped: readonly Unmapped[]
  readonly todo: readonly Todo[]
}

/** The longest form name a title becomes, so `<form>_responses` stays a valid table name. */
const MAX_FORM_NAME = 40

const formNameOf = (title: string, prefix: string | undefined): string => {
  const kebab = prefixedName(prefix, toKebabName(title, 'form'), 'kebab')
  if (kebab.length <= MAX_FORM_NAME) return kebab
  const cut = kebab.slice(0, MAX_FORM_NAME)
  return cut.lastIndexOf('-') > 0 ? cut.slice(0, cut.lastIndexOf('-')) : cut
}

/** `$query.<name>` when the hidden field's name can be read from a link. */
const QUERY_NAME = /^[a-zA-Z_][a-zA-Z0-9_.]*$/

const fieldOfColumn = (column: FormColumn, logic: FormLogic): ConfigEntry => {
  const visible = logic.visibility.get(column.key)
  const required = logic.requirement.get(column.key)
  const visibleWhen = visible === undefined ? undefined : toVisibleWhen(visible)
  const requiredWhen = required === undefined ? undefined : toVisibleWhen(required)
  return {
    kind: 'table-field',
    column: column.name,
    ...(column.question?.required === true ? { required: true } : {}),
    ...(visibleWhen === undefined ? {} : { visibleWhen }),
    ...(requiredWhen === undefined ? {} : { requiredWhen }),
  }
}

/** The form fields, in reading order: questions and sections, then hidden and computed fields. */
const formFields = (
  form: CanonicalForm,
  columns: readonly FormColumn[],
  logic: FormLogic
): readonly ConfigEntry[] => {
  const tool = form.tool as FormSourceTool
  const byKey = new Map(columns.map((column) => [column.key, column] as const))
  const questions = form.questions
    .filter((question) => question.retired !== true)
    .flatMap((question): readonly ConfigEntry[] => {
      if (isAnswerable(tool, question)) {
        const column = byKey.get(question.sourceId)
        return column === undefined ? [] : [fieldOfColumn(column, logic)]
      }
      if (question.title.trim() === '' && question.description === undefined) return []
      return [
        {
          kind: 'section',
          ...(question.title.trim() === '' ? {} : { heading: question.title.trim() }),
          ...(question.description === undefined ? {} : { description: question.description }),
        },
      ]
    })
  const hidden = columns
    .filter((column) => column.role === 'hidden')
    .map((column) => ({ kind: 'table-field', column: column.name, hidden: true }))
  const computed = columns.flatMap((column) => {
    const formula = logic.formulas.get(column.label)
    return column.role === 'variable' && formula !== undefined
      ? [{ kind: 'calculation', name: column.name, label: column.label, formula }]
      : []
  })
  return [...questions, ...hidden, ...computed]
}

/** One step of a multi-step form, with the page it came from. */
interface PagedStep {
  readonly page: string
  readonly id: string
  readonly title?: string
  readonly fields: readonly string[]
}

/** One step per page holding at least one field, with the page it came from; none for a single page. */
const stepsOf = (
  form: CanonicalForm,
  columns: readonly FormColumn[],
  fields: readonly ConfigEntry[]
): readonly PagedStep[] | undefined => {
  const pages = form.pages.map((page) => ({
    page,
    fields: columns
      .filter((column) => column.role === 'question' && column.question?.page === page.sourceId)
      .map((column) => column.name),
  }))
  const filled = pages.filter((one) => one.fields.length > 0)
  if (filled.length < 2) return undefined
  const extra = fields.flatMap((field) =>
    field['kind'] === 'calculation'
      ? [String(field['name'])]
      : field['hidden'] === true
        ? [String(field['column'])]
        : []
  )
  return filled.map((one, index) => ({
    page: one.page.sourceId,
    id: `step-${String(index + 1)}`,
    ...(one.page.title === undefined || one.page.title.trim() === ''
      ? {}
      : { title: one.page.title.trim() }),
    fields: index === filled.length - 1 ? [...one.fields, ...extra] : one.fields,
  }))
}

/** The steps as the config writes them, each with the branches that leave it. */
const withBranches = (
  steps: readonly PagedStep[] | undefined,
  goToWhen: FormBranches['goToWhen']
): readonly ConfigEntry[] | undefined =>
  steps?.map(({ page: _page, ...step }) => {
    const rules = goToWhen.get(step.id)
    return rules === undefined ? step : { ...step, goToWhen: rules }
  })

/** A form address `onSuccess` accepts: http(s), or a path on the site. */
const SAFE_URL = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/

/** A text kept under its key, when it holds anything. */
const textEntry = (key: string, text: string | undefined): ConfigEntry => {
  const trimmed = text?.trim() ?? ''
  return trimmed === '' ? {} : { [key]: trimmed }
}

const onSuccessOf = (form: CanonicalForm): ConfigEntry | undefined => {
  const screen = form.thankYou
  if (screen === undefined) return undefined
  if (screen.redirectUrl !== undefined && SAFE_URL.test(screen.redirectUrl)) {
    return { type: 'redirect', url: screen.redirectUrl }
  }
  const texts = { ...textEntry('title', screen.title), ...textEntry('message', screen.message) }
  return Object.keys(texts).length === 0 ? undefined : { type: 'successPage', ...texts }
}

/** The hidden fields filled from the link, and the ones whose name a link cannot carry. */
const prefillOf = (form: CanonicalForm, columns: readonly FormColumn[]) => {
  const hidden = columns.filter((column) => column.role === 'hidden')
  const readable = hidden.filter((column) => QUERY_NAME.test(column.label))
  return {
    prefill: Object.fromEntries(readable.map((column) => [column.name, `$query.${column.label}`])),
    unreadable: hidden.filter((column) => !QUERY_NAME.test(column.label)),
  }
}

interface Planned {
  readonly entry: ConfigEntry
  readonly table: MappedTable
  readonly created: FormsSection['created'][number]
  readonly fields: TableFields
  readonly unmapped: readonly Unmapped[]
  readonly todo: readonly Todo[]
}

const planOne = (
  form: CanonicalForm,
  name: string,
  ids: { readonly form: number; readonly table: number }
): Planned => {
  const tableName = `${name.replaceAll('-', '_')}${RESPONSES_TABLE_SUFFIX}`
  const columns = planFormColumns(form)
  const column = (key: string) => columns.find((one) => one.key === key)?.name
  const fieldsOf = {
    question: column,
    hidden: (hidden: string) => column(hiddenKey(hidden)),
    variable: (variable: string) => column(variableKey(variable)),
    numeric: (key: string) =>
      ['number', 'integer', 'decimal', 'rating'].includes(
        columns.find((one) => one.key === key)?.type ?? ''
      ),
  }
  const logic = planFormLogic(form, fieldsOf)
  const fields = formFields(form, columns, logic)
  const paged = stepsOf(form, columns, fields)
  const branches = planFormBranches(form, paged ?? [], fieldsOf)
  const steps = withBranches(paged, branches.goToWhen)
  const onSuccess = onSuccessOf(form)
  const { prefill, unreadable } = prefillOf(form, columns)
  const entry: ConfigEntry = {
    id: ids.form,
    name,
    title: form.title,
    ...(form.description === undefined || form.description.trim() === ''
      ? {}
      : { description: form.description.trim() }),
    submitTo: { table: tableName },
    fields,
    ...(steps === undefined ? {} : { layout: 'multi-step', steps }),
    ...(Object.keys(prefill).length === 0 ? {} : { prefill }),
    ...(onSuccess === undefined ? {} : { onSuccess }),
  }
  const where = (key: string | undefined) => {
    const at = key === undefined ? undefined : (column(key) ?? column(variableKey(key)))
    return at === undefined ? `forms.${name}` : `forms.${name}.fields.${at}`
  }
  return {
    entry,
    table: formTableOf(form, tableName, ids.table, columns),
    fields: [
      ...columns.map((one) => ({
        table: tableName,
        field: one.name,
        sourceType: one.sourceType,
        type: one.type,
        outcome: one.outcome,
        ...(one.reason === undefined ? {} : { reason: one.reason }),
      })),
      {
        table: tableName,
        field: SOURCE_ID_FIELD,
        sourceType: 'response id',
        type: 'single-line-text',
        outcome: 'mapped' as const,
      },
    ],
    created: {
      name,
      source: form.title,
      table: tableName,
      fields: fields.length,
      steps: steps?.length ?? 0,
      responses: form.responses.length,
      definitionInferred: form.definitionInferred,
    },
    unmapped: [
      ...columns
        .filter((one) => one.outcome === 'unmapped')
        .map((one) => ({
          domain: 'forms' as const,
          source: `${form.title} / ${one.label} (${one.sourceType})`,
          kind: 'question' as const,
          reason: one.reason ?? 'No Sovrium form field answers this question.',
          fallback: one.type,
        })),
      ...columns
        .filter((one) => one.role === 'retired')
        .map((one) => ({
          domain: 'forms' as const,
          source: `${form.title} / ${one.label} (${one.sourceType})`,
          kind: 'question' as const,
          reason:
            'Past responses answer this question but the form no longer has it: its answers are kept in a column, and it is not a field of the form.',
          fallback: `column ${one.name}`,
        })),
      ...unreadable.map((one) => ({
        domain: 'forms' as const,
        source: `${form.title} / ${one.label} (hidden field)`,
        kind: 'other' as const,
        reason:
          'The name cannot be read from a link query, so the field is kept but not prefilled.',
      })),
      ...(form.notExposed ?? []).map((what) => ({
        domain: 'forms' as const,
        source: `${form.title} (${form.tool})`,
        kind: 'rule' as const,
        reason: what,
      })),
    ],
    todo: [...logic.todo, ...branches.todo].map((item) => ({
      domain: 'forms' as const,
      target: where(item.question ?? item.variable),
      original: item.original,
      reason: item.reason,
    })),
  }
}

/** Map forms onto `forms[]` entries and their responses tables. */
export const planForms = (
  forms: readonly CanonicalForm[],
  context: FormMappingContext
): FormPlan => {
  const names = uniqueNames(
    forms.map((form) => formNameOf(form.title, context.prefix)),
    'kebab'
  )
  const planned = forms.map((form, index) =>
    planOne(form, names[index] ?? 'form', {
      form: context.maxFormId + index + 1,
      table: context.maxTableId + index + 1,
    })
  )
  return {
    forms: planned.map((one) => one.entry),
    tables: planned.map((one) => one.table),
    section: { created: planned.map((one) => one.created) },
    fields: planned.flatMap((one) => one.fields),
    unmapped: planned.flatMap((one) => one.unmapped),
    todo: planned.flatMap((one) => one.todo),
  }
}
