/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typeform responses (`GET /forms/{id}/responses`) as responses.
 *
 * - A response is keyed on `token`: the official example omits `response_id`.
 * - An answer is matched to its question by id, then by `ref` when the form
 *   was rebuilt and the question with that `ref` has no answer of its own; an
 *   answer to a question the form no longer has keeps a retired question of
 *   its own, so nothing is dropped.
 * - An answer's value sits under the key its `type` names (`choice.label`,
 *   `choices.labels`, `file_url`, …); a file is the one the fetch downloaded.
 * - The computed variables come from `variables[]`, else `calculated.score`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  attachmentValue,
  fileNameOfUrl,
  objectsOf,
  plainAnswer,
  textOf,
  type FormAsset,
} from './form-snapshot-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

type Reader = (value: unknown, assets: ReadonlyMap<string, FormAsset>) => CanonicalValue | undefined

const textList = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []

/** The answer types whose value is not kept as it is. */
const READERS: Readonly<Record<string, Reader>> = {
  choice: (value) =>
    isRecord(value) ? (textOf(value['label']) ?? textOf(value['other'])) : undefined,
  choices: (value) =>
    isRecord(value) ? [...textList(value['labels']), ...textList([value['other']])] : undefined,
  file_url: (value, assets) =>
    typeof value === 'string' ? attachmentValue(assets, value, fileNameOfUrl(value)) : undefined,
  date: (value) => (typeof value === 'string' ? value.slice(0, 10) : plainAnswer(value)),
}

/** An answer's value, in the shape the column holds. */
const answerValue = (
  answer: Json,
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  const type = String(answer['type'] ?? '')
  const read = READERS[type] ?? plainAnswer
  return read(answer[type], assets)
}

/** A question the form no longer has, named by the answer that still answers it. */
const retiredOf = (field: Json): Question => {
  const id = String(field['id'] ?? '')
  return {
    sourceId: id,
    ...(textOf(field['ref']) === undefined ? {} : { ref: String(field['ref']) }),
    title: String(field['ref'] ?? id),
    sourceType: String(field['type'] ?? 'unknown'),
    required: false,
    retired: true,
  }
}

/**
 * The question an answer belongs to: by id, else by ref when that question has
 * no answer of its own in the response, else a retired question of its own.
 */
const placeAnswer = (
  questions: readonly Question[],
  answered: ReadonlySet<string>,
  field: Json
): Question => {
  const id = String(field['id'] ?? '')
  const byId = questions.find((question) => question.sourceId === id)
  const byRef = questions.find(
    (question) =>
      question.ref !== undefined &&
      question.ref === field['ref'] &&
      !answered.has(question.sourceId)
  )
  return byId ?? byRef ?? retiredOf(field)
}

/** The computed variables a response carries, for the variables the form declares. */
const variablesOf = (item: Json, declared: ReadonlySet<string>) => {
  const listed = objectsOf(item['variables']).flatMap((variable) => {
    const key = String(variable['key'] ?? '')
    const value = variable[String(variable['type'])]
    return declared.has(key) && (typeof value === 'number' || typeof value === 'string')
      ? [[key, value] as const]
      : []
  })
  const calculated = isRecord(item['calculated']) ? item['calculated'] : {}
  const fallback =
    declared.has('score') && typeof calculated['score'] === 'number'
      ? [['score', calculated['score']] as const]
      : []
  return Object.fromEntries([...fallback, ...listed])
}

const hiddenOf = (item: Json): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(isRecord(item['hidden']) ? item['hidden'] : {}).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value] as const] : []
    )
  )

interface Placed {
  readonly known: readonly Question[]
  readonly answers: Readonly<Record<string, CanonicalValue>>
}

/** One response's answers, placed on the known questions, a retired one added as needed. */
const placeAnswers = (
  item: Json,
  known: readonly Question[],
  assets: ReadonlyMap<string, FormAsset>
): Placed => {
  const answers = objectsOf(item['answers'])
  const fieldOf = (answer: Json): Json => (isRecord(answer['field']) ? answer['field'] : {})
  const ids = answers.map((answer) => String(fieldOf(answer)['id'] ?? ''))
  return answers.reduce<Placed>(
    (acc, answer) => {
      const taken = new Set([...ids, ...Object.keys(acc.answers)])
      const question = placeAnswer(acc.known, taken, fieldOf(answer))
      const value = answerValue(answer, assets)
      return {
        known: acc.known.includes(question) ? acc.known : [...acc.known, question],
        answers: value === undefined ? acc.answers : { ...acc.answers, [question.sourceId]: value },
      }
    },
    { known, answers: {} }
  )
}

/** The responses of every page, and the retired questions only they answer. */
export const typeformResponsesOf = (
  pages: readonly unknown[],
  questions: readonly Question[],
  declared: ReadonlySet<string>,
  assets: ReadonlyMap<string, FormAsset>
): { readonly retired: readonly Question[]; readonly responses: readonly Response[] } =>
  pages
    .flatMap((page) => objectsOf(isRecord(page) ? page['items'] : undefined))
    .reduce<{ readonly retired: readonly Question[]; readonly responses: readonly Response[] }>(
      (state, item) => {
        const placed = placeAnswers(item, [...questions, ...state.retired], assets)
        const variables = variablesOf(item, declared)
        const response: Response = {
          sourceId: String(item['token'] ?? item['response_id'] ?? item['landing_id']),
          submittedAt: String(item['submitted_at'] ?? item['landed_at'] ?? ''),
          answers: placed.answers,
          hidden: hiddenOf(item),
          ...(Object.keys(variables).length === 0 ? {} : { variables }),
        }
        return {
          retired: placed.known.slice(questions.length),
          responses: [...state.responses, response],
        }
      },
      { retired: [], responses: [] }
    )
