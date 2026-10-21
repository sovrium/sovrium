/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Google Forms responses (`forms.responses.list`) into canonical responses.
 *
 * Every answer arrives as text: `textAnswers.answers[].value`, one entry per
 * picked checkbox, a scale or a rating as its number written out, a date as
 * `YYYY-MM-DD` with ` HH:MM` when the question asks the time. A file answer is
 * a list of Drive files (`fileUploadAnswers`), never a URL: it is kept as the
 * file names with their Drive ids, the files themselves staying in Drive.
 *
 * The email the form collected and the quiz's total score sit on the response
 * itself, and are read into the email question and the score variable.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf, oldestFirst, textOf } from './form-snapshot-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

/** The question an email collected by the form becomes. */
export const RESPONDENT_EMAIL_ID = 'respondentEmail'

/** The variable each response's quiz score is kept under. */
export const TOTAL_SCORE = 'total_score'

const NUMBER_TYPES: ReadonlySet<string> = new Set(['scaleQuestion', 'ratingQuestion'])

/** The text values of one answer. */
const textsOf = (answer: Json): readonly string[] =>
  objectsOf(isRecord(answer['textAnswers']) ? answer['textAnswers']['answers'] : undefined)
    .map((one) => textOf(one['value']))
    .filter((value): value is string => value !== undefined && value !== '')

/** The files of a file answer, as text: each name with its Drive id. */
const driveFilesOf = (answer: Json): string | undefined => {
  const files = objectsOf(
    isRecord(answer['fileUploadAnswers']) ? answer['fileUploadAnswers']['answers'] : undefined
  ).map(
    (file) => `${String(file['fileName'] ?? 'file')} (Drive file ${String(file['fileId'] ?? '?')})`
  )
  return files.length === 0 ? undefined : files.join('\n')
}

/** A date with its time, `YYYY-MM-DD HH:MM`, as an ISO date-time. */
const dateTimeOf = (text: string): string =>
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ? `${text.replace(' ', 'T')}:00` : text

/** One answer, in the shape its column holds. */
const valueOf = (question: Question | undefined, answer: Json): CanonicalValue | undefined => {
  const type = question?.sourceType ?? ''
  if (type === 'fileUploadQuestion') return driveFilesOf(answer)
  const texts = textsOf(answer)
  const [first] = texts
  if (first === undefined) return undefined
  if (type === 'choiceQuestion.CHECKBOX') return texts
  if (NUMBER_TYPES.has(type)) {
    const number = Number(first)
    return Number.isFinite(number) ? number : first
  }
  return type === 'dateQuestion.time' ? dateTimeOf(first) : first
}

const responseOf = (response: Json, questions: ReadonlyMap<string, Question>): Response => {
  const answers = Object.entries(isRecord(response['answers']) ? response['answers'] : {})
    .filter((entry): entry is [string, Json] => isRecord(entry[1]) && questions.has(entry[0]))
    .flatMap(([id, answer]) => {
      const value = valueOf(questions.get(id), answer)
      return value === undefined ? [] : [[id, value] as const]
    })
  const email = textOf(response['respondentEmail'])
  const score = response['totalScore']
  return {
    sourceId: String(response['responseId']),
    submittedAt: String(response['lastSubmittedTime'] ?? response['createTime'] ?? ''),
    answers: Object.fromEntries([
      ...answers,
      ...(email !== undefined && questions.has(RESPONDENT_EMAIL_ID)
        ? [[RESPONDENT_EMAIL_ID, email] as const]
        : []),
    ]),
    ...(typeof score === 'number' && Number.isFinite(score)
      ? { variables: { [TOTAL_SCORE]: score } }
      : {}),
  }
}

/** Every response of the response pages, oldest first. */
export const readGoogleFormsResponses = (
  pages: readonly unknown[],
  questions: readonly Question[]
): readonly Response[] => {
  const byId = new Map(questions.map((question) => [question.sourceId, question] as const))
  return oldestFirst(
    pages
      .flatMap((page) => objectsOf(isRecord(page) ? page['responses'] : undefined))
      .map((response) => responseOf(response, byId))
  )
}
