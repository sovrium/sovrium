/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tally submissions (`GET /forms/{id}/submissions`) as responses.
 *
 * Each page repeats the form's `questions[]`, whose `fields[].blockGroupUuid`
 * ties a submission's `questionId` to the question the blocks declared. An
 * answer is read by its question's type:
 *
 * - a choice is an array of option ids, read as their labels (one label for a
 *   single choice);
 * - a file or a signature is an array of `{ id, name, url, mimeType }`, kept
 *   as the files the fetch downloaded;
 * - the hidden-fields question answers the hidden field it names, and a
 *   calculated field the variable it names.
 *
 * The REST answer shapes are inferred from Tally's webhook example, pinned
 * beside the captures: a value of another shape is kept as its JSON text
 * rather than dropped.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  attachmentValue,
  objectsOf,
  oldestFirst,
  plainAnswer,
  textOf,
  type FormAsset,
} from './form-snapshot-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

/** The hidden fields and variables, by block uuid. */
export interface TallyNames {
  readonly hidden: ReadonlyMap<string, string>
  readonly variables: ReadonlyMap<string, string>
}

const FILE_TYPES: ReadonlySet<string> = new Set(['FILE_UPLOAD', 'SIGNATURE'])

/** What one submission question answers. */
type Target =
  | { readonly kind: 'question'; readonly question: Question }
  | { readonly kind: 'hidden'; readonly names: readonly string[] }
  | { readonly kind: 'variable'; readonly name: string }

/** The question a submission question answers, retired when the blocks no longer hold it. */
const questionTarget = (described: Json, questions: readonly Question[]): Target => {
  const groups = new Set(
    objectsOf(described['fields']).map((field) => String(field['blockGroupUuid'] ?? field['uuid']))
  )
  return {
    kind: 'question',
    question: questions.find((one) => groups.has(one.sourceId)) ?? {
      sourceId: String(described['id']),
      title: String(described['title'] ?? described['id']),
      sourceType: String(described['type'] ?? 'unknown'),
      required: false,
      retired: true,
    },
  }
}

/** What a submission question answers: a question, the hidden fields, or a variable. */
const targetOf = (described: Json, questions: readonly Question[], names: TallyNames): Target => {
  const uuids = objectsOf(described['fields']).map((field) => String(field['uuid']))
  const title = String(described['title'] ?? '')
  const hidden = uuids.flatMap((uuid) => names.hidden.get(uuid) ?? [])
  if (described['type'] === 'HIDDEN_FIELDS' || hidden.length > 0) {
    return { kind: 'hidden', names: hidden.length > 0 ? hidden : [title] }
  }
  const [variable] = uuids.flatMap((uuid) => names.variables.get(uuid) ?? [])
  if (described['type'] === 'CALCULATED_FIELDS' || variable !== undefined) {
    return { kind: 'variable', name: variable ?? title }
  }
  return questionTarget(described, questions)
}

/** The types whose answer is one choice, though the API sends a list. */
const SINGLE_CHOICE: ReadonlySet<string> = new Set(['MULTIPLE_CHOICE', 'DROPDOWN'])

/** A choice answer: option ids read as their labels, one label for a single choice. */
const choiceAnswer = (question: Question, ids: readonly string[]): CanonicalValue | undefined => {
  const labels = new Map(
    (question.choices ?? []).flatMap((choice) =>
      choice.sourceId === undefined ? [] : [[choice.sourceId, choice.label] as const]
    )
  )
  const read = ids.map((id) => labels.get(id) ?? id)
  return SINGLE_CHOICE.has(question.sourceType) && question.allowMultiple !== true ? read[0] : read
}

/** A file answer: the files the fetch downloaded. */
const fileAnswer = (
  answer: readonly unknown[],
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  const files = objectsOf(answer).map((file) =>
    attachmentValue(
      assets,
      String(file['url'] ?? file['id']),
      String(file['name'] ?? 'file'),
      textOf(file['mimeType'])
    )
  )
  return files.length === 0 ? undefined : (files as CanonicalValue)
}

/** An answer to a question, in the shape its column holds. */
const answerOf = (
  question: Question,
  answer: unknown,
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  if (!Array.isArray(answer)) return plainAnswer(answer)
  if (FILE_TYPES.has(question.sourceType)) return fileAnswer(answer, assets)
  return answer.every((one) => typeof one === 'string')
    ? choiceAnswer(question, answer)
    : plainAnswer(answer)
}

/** The hidden-field values a hidden-fields answer carries. */
const hiddenOf = (names: readonly string[], answer: unknown): Readonly<Record<string, string>> => {
  if (isRecord(answer)) {
    return Object.fromEntries(
      Object.entries(answer).flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value] as const] : []
      )
    )
  }
  const [name] = names
  return typeof answer === 'string' && name !== undefined ? { [name]: answer } : {}
}

/** One submission as a response. */
const responseOf = (
  submission: Json,
  targets: ReadonlyMap<string, Target>,
  assets: ReadonlyMap<string, FormAsset>
): Response => {
  const read = objectsOf(submission['responses']).map((one) => ({
    target: targets.get(String(one['questionId'])),
    answer: one['answer'],
  }))
  const answers = Object.fromEntries(
    read.flatMap(({ target, answer }) => {
      if (target?.kind !== 'question') return []
      const value = answerOf(target.question, answer, assets)
      return value === undefined ? [] : [[target.question.sourceId, value] as const]
    })
  )
  const hidden = Object.fromEntries(
    read.flatMap(({ target, answer }) =>
      target?.kind === 'hidden' ? Object.entries(hiddenOf(target.names, answer)) : []
    )
  )
  const variables = Object.fromEntries(
    read.flatMap(({ target, answer }) =>
      target?.kind === 'variable' && (typeof answer === 'number' || typeof answer === 'string')
        ? [[target.name, answer] as const]
        : []
    )
  )
  return {
    sourceId: String(submission['id']),
    submittedAt: String(submission['submittedAt'] ?? submission['createdAt'] ?? ''),
    answers,
    hidden,
    ...(Object.keys(variables).length === 0 ? {} : { variables }),
  }
}

/** The submissions of every page, and the retired questions only they answer. */
export const tallyResponsesOf = (
  pages: readonly unknown[],
  questions: readonly Question[],
  names: TallyNames,
  assets: ReadonlyMap<string, FormAsset>
): { readonly responses: readonly Response[]; readonly retired: readonly Question[] } => {
  const described = pages.flatMap((page) =>
    objectsOf(isRecord(page) ? page['questions'] : undefined)
  )
  const targets = new Map(
    described.map((one) => [String(one['id']), targetOf(one, questions, names)] as const)
  )
  const retired = [...targets.values()].flatMap((target) =>
    target.kind === 'question' && target.question.retired === true ? [target.question] : []
  )
  const submissions = pages.flatMap((page) =>
    objectsOf(isRecord(page) ? page['submissions'] : undefined)
  )
  return {
    responses: oldestFirst(
      submissions.map((submission) => responseOf(submission, targets, assets))
    ),
    retired: retired.filter(
      (one, index) => retired.findIndex((other) => other.sourceId === one.sourceId) === index
    ),
  }
}
