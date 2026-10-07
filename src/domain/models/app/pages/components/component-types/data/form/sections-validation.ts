/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldNamesMatch } from '../../../../../tables/field-name-matching'

/**
 * Page-form `sections` cross-validation.
 *
 * A section names fields by their name. Two mistakes survive the per-node
 * schema, because each needs something the section struct cannot see:
 *
 *  1. A name the form never draws — a typo, or a column removed since. The
 *     form draws the entries of its own `fields[]` when it declares one, and
 *     the columns of its bound table otherwise; a name outside that set would
 *     leave an empty heading on the page with nothing saying why.
 *  2. A name listed in two sections. A field is drawn once, so one of the two
 *     headings would silently lose it.
 *
 * Both are refused when the config loads, naming the section and the field.
 * Names are compared with the same folding the form renderer uses
 * (`fieldNamesMatch`), so a config the form draws correctly is never refused
 * for spelling a column `billingEmail` instead of `billing_email`.
 *
 * The walk is loose-typed and recursive, so a form is found wherever it sits:
 * a page's `components[]`, a container's `children[]`, a drawer's body.
 */

/** Minimal shape needed to validate form sections. */
interface AppForFormSectionValidation {
  readonly pages?: unknown
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{ readonly name: string }>
  }>
}

interface FoundSection {
  readonly title: string
  readonly fields: readonly string[]
}

/** One sectioned form, with the names it draws (undefined when unknowable). */
interface FoundSectionedForm {
  readonly sections: readonly FoundSection[]
  readonly drawn: readonly string[] | undefined
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

const readSections = (value: unknown): readonly FoundSection[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const record = asRecord(entry)
        if (record === undefined || typeof record['title'] !== 'string') return []
        return [{ title: record['title'], fields: stringsOf(record['fields']) }]
      })
    : []

/** The table a form is bound to: its `dataSource.table`, else its `action.table`. */
const boundTableOf = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const fromSource = asRecord(record['dataSource'])?.['table']
  if (typeof fromSource === 'string') return fromSource
  const fromAction = asRecord(record['action'])?.['table']
  return typeof fromAction === 'string' ? fromAction : undefined
}

/**
 * The names a form draws: its `fields[].field` entries when it declares any,
 * otherwise the columns of its bound table. `undefined` when neither can be
 * read — a form bound to a table this app does not declare is another
 * validator's refusal, not this one's.
 */
const drawnNamesOf = (
  record: Readonly<Record<string, unknown>>,
  app: AppForFormSectionValidation
): readonly string[] | undefined => {
  const declared = Array.isArray(record['fields'])
    ? record['fields'].flatMap((entry) => {
        const field = asRecord(entry)?.['field']
        return typeof field === 'string' ? [field] : []
      })
    : []
  if (declared.length > 0) return declared
  const tableName = boundTableOf(record)
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.map((field) => field.name)
}

const collectSectionedForms = (
  node: unknown,
  app: AppForFormSectionValidation
): readonly FoundSectionedForm[] => {
  if (Array.isArray(node)) return node.flatMap((child) => collectSectionedForms(child, app))
  const record = asRecord(node)
  if (record === undefined) return []
  const nested = Object.values(record).flatMap((child) => collectSectionedForms(child, app))
  if (record['type'] !== 'form' || !Array.isArray(record['sections'])) return nested
  return [
    { sections: readSections(record['sections']), drawn: drawnNamesOf(record, app) },
    ...nested,
  ]
}

/** The first section field the form does not draw, as a message. */
const unknownFieldIssue = (form: FoundSectionedForm): string | undefined => {
  const { drawn } = form
  if (drawn === undefined) return undefined
  const miss = form.sections
    .flatMap((section) => section.fields.map((field) => ({ section, field })))
    .find(({ field }) => !drawn.some((name) => fieldNamesMatch(name, field)))
  if (miss === undefined) return undefined
  return `Form section '${miss.section.title}' lists field '${miss.field}', which the form does not draw. A section may name only a field of the form's own fields[], or a column of its bound table when it declares none. Drawn here: ${drawn.join(', ')}`
}

/** The first field listed in two sections, as a message. */
const duplicateFieldIssue = (form: FoundSectionedForm): string | undefined => {
  const listed = form.sections.flatMap((section) =>
    section.fields.map((field) => ({ section: section.title, field }))
  )
  const twice = listed
    .map((entry, index) => ({
      entry,
      first: listed.findIndex((other) => fieldNamesMatch(other.field, entry.field)),
      index,
    }))
    .find(({ first, index }) => first !== index)
  if (twice === undefined) return undefined
  const firstSection = listed[twice.first]!.section
  return `Field '${twice.entry.field}' is listed in two form sections ('${firstSection}' and '${twice.entry.section}'). A field is drawn once, so it may sit in one section only.`
}

/**
 * Validate every page form declaring `sections`.
 *
 * Returns `true` when every section names only fields its form draws, each in
 * one section, or the message naming the first offending section and field.
 */
export const validateAllFormSections = (app: AppForFormSectionValidation): string | true => {
  if (!app.pages) return true
  const issue = collectSectionedForms(app.pages, app)
    .map((form) => unknownFieldIssue(form) ?? duplicateFieldIssue(form))
    .find((message) => message !== undefined)
  return issue ?? true
}
