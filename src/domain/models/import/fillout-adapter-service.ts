/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Fillout adapter: a form's metadata (`GET /forms/{id}`) and its
 * submission pages into a `CanonicalForm`, pinned under
 * `[internal ref]`.
 *
 * Fillout's API gives each question's id, label and type, the choice options
 * of a choice question, the URL parameters (hidden fields) and the names of
 * the calculations — and NOT the pages, the conditional logic, the required
 * flags or the calculation formulas. So a Fillout form is
 * imported as one page with no rules, each calculation a column holding the
 * values Fillout computed, and the report says what the API did not expose.
 *
 * A choice matrix reads back as one `MultipleChoice` per row, named
 * ` (<matrix title>)`: each row becomes a column of its own. Scheduling and
 * payment fields are kept as text columns.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  attachmentValue,
  objectsOf,
  oldestFirst,
  plainAnswer,
  readFormSnapshot,
  textOf,
  type FormAsset,
} from './form-snapshot-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

/** What Fillout's API does not expose about a form, reported once per form. */
const NOT_EXPOSED =
  "Fillout's API does not expose the form's pages, conditional logic, required answers or calculation formulas: the form is imported as one page with no rules, and each calculation keeps the values Fillout computed. Recreate them by hand."

/** The type a scheduling or a payment field is kept as. */
const EXTRA_TYPES: Readonly<Record<'scheduling' | 'payments', string>> = {
  scheduling: 'Scheduling',
  payments: 'Payment',
}

const questionOf = (question: Json, sourceType?: string): Question => {
  const choices = objectsOf(question['options'])
    .map((option) => ({
      ...(textOf(option['id']) === undefined ? {} : { sourceId: String(option['id']) }),
      label: String(option['label'] ?? option['value'] ?? '').trim(),
    }))
    .filter((choice) => choice.label !== '')
  const name = String(question['name'] ?? question['id']).trim()
  return {
    sourceId: String(question['id']),
    title: name.replace(/^\((.*)\)$/, '$1'),
    sourceType: sourceType ?? String(question['type'] ?? 'unknown'),
    required: false,
    ...(choices.length === 0 ? {} : { choices }),
  }
}

const FILE_TYPES: ReadonlySet<string> = new Set(['FileUpload', 'Signature'])

/** The files a file answer names. */
const filesOf = (
  value: unknown,
  assets: ReadonlyMap<string, FormAsset>
): readonly CanonicalValue[] =>
  objectsOf(Array.isArray(value) ? value : [value]).flatMap((file) =>
    typeof file['url'] === 'string'
      ? [attachmentValue(assets, file['url'], String(file['filename'] ?? 'file'))]
      : []
  )

/** A submitted value, in the shape its column holds. */
const valueOf = (
  question: Question | undefined,
  value: unknown,
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  const files = FILE_TYPES.has(question?.sourceType ?? '') ? filesOf(value, assets) : []
  return files.length > 0 ? (files as CanonicalValue) : plainAnswer(value)
}

/** A calculation's value: a number for a number calculation, else text. */
const computedOf = (kind: string | undefined, value: unknown): CanonicalValue | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value === '') return undefined
  const number = Number(value)
  return kind === 'number' && Number.isFinite(number) ? number : value
}

const namedValues = (list: unknown): readonly (readonly [string, unknown])[] =>
  objectsOf(list).map((item) => [String(item['name'] ?? item['id']), item['value']] as const)

/** One submission as a response, and the questions it answers that the form no longer has. */
const responseOf = (
  submission: Json,
  questions: ReadonlyMap<string, Question>,
  kinds: ReadonlyMap<string, string>,
  assets: ReadonlyMap<string, FormAsset>
): { readonly response: Response; readonly retired: readonly Question[] } => {
  const answered = [
    ...objectsOf(submission['questions']),
    ...objectsOf(submission['scheduling']),
    ...objectsOf(submission['payments']),
  ]
  const retired = objectsOf(submission['questions'])
    .filter((one) => !questions.has(String(one['id'])))
    .map((one) => ({ ...questionOf(one), retired: true }))
  const known = new Map([...questions, ...retired.map((one) => [one.sourceId, one] as const)])
  const answers = Object.fromEntries(
    answered.flatMap((one) => {
      const id = String(one['id'])
      const value = valueOf(known.get(id), one['value'], assets)
      return value === undefined || !known.has(id) ? [] : [[id, value] as const]
    })
  )
  const quiz = isRecord(submission['quiz']) ? submission['quiz']['score'] : undefined
  const variables = Object.fromEntries([
    ...namedValues(submission['calculations']).flatMap(([name, value]) => {
      const read = computedOf(kinds.get(name), value)
      return read === undefined ? [] : [[name, read] as const]
    }),
    ...(typeof quiz === 'number' ? [['quiz_score', quiz] as const] : []),
  ])
  return {
    response: {
      sourceId: String(submission['submissionId']),
      submittedAt: String(submission['submissionTime'] ?? submission['lastUpdatedAt'] ?? ''),
      answers,
      hidden: Object.fromEntries(
        namedValues(submission['urlParameters']).flatMap(([name, value]) =>
          typeof value === 'string' ? [[name, value] as const] : []
        )
      ),
      ...(Object.keys(variables).length === 0 ? {} : { variables }),
    },
    retired,
  }
}

/** Whether a JSON document is a Fillout form's metadata. */
export const isFilloutForm = (json: unknown): boolean =>
  isRecord(json) &&
  typeof json['id'] === 'string' &&
  typeof json['name'] === 'string' &&
  Array.isArray(json['questions']) &&
  !('blocks' in json) &&
  !('fields' in json) &&
  objectsOf(json['questions']).every(
    (question) => typeof question['id'] === 'string' && typeof question['type'] === 'string'
  )

/** Read a Fillout snapshot (or a metadata file) into a `CanonicalForm`. */
export const adaptFilloutSnapshot = (files: ReadonlyMap<string, unknown>): CanonicalForm => {
  const snapshot = readFormSnapshot(files)
  const form = isRecord(snapshot.definition) ? snapshot.definition : {}
  const questions = [
    ...objectsOf(form['questions']).map((question) => questionOf(question)),
    ...(['scheduling', 'payments'] as const).flatMap((key) =>
      objectsOf(form[key]).map((question) => questionOf(question, EXTRA_TYPES[key]))
    ),
  ]
  const calculations = objectsOf(form['calculations'])
  const quiz = isRecord(form['quiz']) && form['quiz']['enabled'] === true
  const kinds = new Map(
    calculations.map((one) => [String(one['name'] ?? one['id']), String(one['type'])] as const)
  )
  const read = snapshot.pages
    .flatMap((page) => objectsOf(isRecord(page) ? page['responses'] : undefined))
    .map((submission) =>
      responseOf(
        submission,
        new Map(questions.map((one) => [one.sourceId, one] as const)),
        kinds,
        snapshot.assets
      )
    )
  const retired = read.flatMap((one) => one.retired)
  return {
    tool: 'fillout',
    sourceId: String(form['id'] ?? 'form'),
    title: textOf(form['name'])?.trim() || 'Fillout form',
    questions: [
      ...questions,
      ...retired.filter(
        (one, index) => retired.findIndex((other) => other.sourceId === one.sourceId) === index
      ),
    ],
    pages: [],
    rules: [],
    hiddenFields: objectsOf(form['urlParameters']).map((one) => String(one['name'] ?? one['id'])),
    variables: [
      ...calculations.map((one) => ({
        name: String(one['name'] ?? one['id']),
        kind: one['type'] === 'number' ? ('number' as const) : ('text' as const),
      })),
      ...(quiz ? [{ name: 'quiz_score', kind: 'number' as const }] : []),
    ],
    notExposed: [NOT_EXPOSED],
    definitionInferred: false,
    responses: oldestFirst(read.map((one) => one.response)),
  }
}
