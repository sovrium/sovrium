/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Webflow forms adapter: a site's forms and their submissions, read
 * through the Forms API, as `CanonicalForm`s (pinned under
 * `[internal ref]`). The form mapper then makes
 * each one a table-bound form writing to `<form>_responses`, and each
 * submission a record of that table.
 *
 * It reads the files `sovrium import fetch webflow:<siteId>` wrote, parsed:
 *
 * - `raw/forms/page-NNNN.json`: the forms; each field is `{ <fieldId>:
 *   { displayName, type } }`, a type being Plain, Email, Password, Phone or
 *   Number;
 * - `raw/forms/<formId>/submissions-NNNN.json`: the submissions, each
 *   `formResponse` keyed by field display name. A name the form no longer
 *   has is a field removed since: its answers are kept in a column.
 *
 * The Forms API states no required flag, no options, no validation and no
 * logic, so the form is one page with no rules, and the report says so. A
 * Password field is never imported, nor any answer it received.
 */

import { objectsOf, oldestFirst, plainAnswer, textOf } from './form-snapshot-service'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

const FORMS_PAGE = /^raw\/forms\/page-\d+\.json$/

const SUBMISSIONS_PAGE = /^raw\/forms\/([^/]+)\/submissions-\d+\.json$/

/** Whether a snapshot path is a submissions page of one form. */
const isSubmissionsPage = (path: string, formId: string): boolean =>
  SUBMISSIONS_PAGE.exec(path)?.[1] === formId

/** The field type whose answers are never read. */
const PASSWORD = 'Password'

const NOT_EXPOSED =
  "Webflow's Forms API does not expose a field's required flag, options, validation or the form's conditional logic: the form is imported as one page of text, email, phone and number fields. Set them by hand."

const PASSWORD_DROPPED =
  'A Password field is never imported: neither the field nor any answer it received.'

/** The questions of a form, in its order, with the names of its Password fields. */
const questionsOf = (
  form: Json
): { readonly questions: readonly Question[]; readonly passwords: readonly string[] } => {
  const fields = objectsOf(form['fields']).flatMap((entry) =>
    Object.entries(entry).flatMap(([id, field]) => {
      if (typeof field !== 'object' || field === null || Array.isArray(field)) return []
      const read = field as Json
      const title = textOf(read['displayName'])?.trim() ?? ''
      return title === '' ? [] : [{ id, title, type: textOf(read['type']) ?? 'Plain' }]
    })
  )
  return {
    questions: fields
      .filter((field) => field.type !== PASSWORD)
      .map((field) => ({
        sourceId: field.id,
        title: field.title,
        sourceType: field.type,
        required: false,
      })),
    passwords: fields.filter((field) => field.type === PASSWORD).map((field) => field.title),
  }
}

/** A submission's answers, keyed by the display name Webflow wrote them under. */
const answersOf = (submission: Json): readonly (readonly [string, unknown])[] => {
  const given = submission['formResponse']
  return Object.entries(typeof given === 'object' && given !== null ? given : {}).map(
    ([title, value]) => [title.trim(), value] as const
  )
}

/** A retired question's id: the display name its answers were written under. */
const retiredId = (title: string): string => `retired:${title}`

/** One submission as a response, its answers read back to question ids by display name. */
const responseOf = (
  submission: Json,
  byTitle: ReadonlyMap<string, string>
): Response | undefined => {
  const id = textOf(submission['id'])
  if (id === undefined) return undefined
  const answers = Object.fromEntries(
    answersOf(submission).flatMap(([title, value]) => {
      const field = byTitle.get(title)
      const answer = plainAnswer(value)
      return field === undefined || answer === undefined ? [] : [[field, answer] as const]
    })
  )
  return { sourceId: id, submittedAt: textOf(submission['dateSubmitted']) ?? '', answers }
}

/** Every submission of one form, from its pages in order. */
const submissionsOf = (files: ReadonlyMap<string, unknown>, formId: string): readonly Json[] => {
  return [...files.keys()]
    .filter((path) => isSubmissionsPage(path, formId))
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(
        typeof page === 'object' && page !== null ? (page as Json)['formSubmissions'] : undefined
      )
    })
}

/**
 * The questions past submissions answer that the form no longer has: each
 * becomes a retired question, so its answers are kept in a column. An answer
 * under a Password field's name is never one.
 */
const retiredOf = (submissions: readonly Json[], known: ReadonlySet<string>): readonly Question[] =>
  [...new Set(submissions.flatMap((one) => answersOf(one).map(([title]) => title)))]
    .filter((title) => title !== '' && !known.has(title))
    .map((title) => ({
      sourceId: retiredId(title),
      title,
      sourceType: 'Plain',
      required: false,
      retired: true,
    }))

/** One form of the list as a canonical form, with its submissions. */
const formOf = (form: Json, files: ReadonlyMap<string, unknown>): CanonicalForm | undefined => {
  const id = textOf(form['id'])
  const title = textOf(form['displayName'])?.trim()
  if (id === undefined || title === undefined || title === '') return undefined
  const current = questionsOf(form)
  const submissions = submissionsOf(files, id)
  const retired = retiredOf(
    submissions,
    new Set([...current.questions.map((question) => question.title), ...current.passwords])
  )
  const questions = [...current.questions, ...retired]
  const byTitle = new Map(questions.map((question) => [question.title, question.sourceId] as const))
  const settings = form['responseSettings']
  const redirectUrl =
    typeof settings === 'object' && settings !== null
      ? textOf((settings as Json)['redirectUrl'])
      : undefined
  return {
    tool: 'webflow',
    sourceId: id,
    title,
    questions,
    pages: [],
    rules: [],
    hiddenFields: [],
    notExposed: [NOT_EXPOSED, ...(current.passwords.length > 0 ? [PASSWORD_DROPPED] : [])],
    ...(redirectUrl === undefined || redirectUrl === '' ? {} : { thankYou: { redirectUrl } }),
    definitionInferred: false,
    responses: oldestFirst(
      submissions.flatMap((submission) => {
        const response = responseOf(submission, byTitle)
        return response === undefined ? [] : [response]
      })
    ),
  }
}

/** A Webflow snapshot's forms, in the site's order, each with its submissions. */
export const adaptWebflowForms = (files: ReadonlyMap<string, unknown>): readonly CanonicalForm[] =>
  [...files.keys()]
    .filter((path) => FORMS_PAGE.test(path))
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(typeof page === 'object' && page !== null ? (page as Json)['forms'] : [])
    })
    .flatMap((form) => {
      const read = formOf(form, files)
      return read === undefined ? [] : [read]
    })
