/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Jotform submissions (`GET /form/{id}/submissions`, pinned under
 * `[internal ref]`) into canonical responses.
 *
 * A submission keys its answers by question id, each answer carrying the
 * question's type, its text and the value: a string, a list (checkboxes, file
 * URLs) or an object (a full name, an address, a date, a matrix row by row),
 * with a `prettyFormat` text for the compound ones. Each value is read into the
 * shape its column holds:
 *
 * - a number question's text becomes a number;
 * - a full name, an address or a matrix becomes its text (`prettyFormat`, or
 *   its parts joined), the column being text;
 * - a date object becomes an ISO date;
 * - an uploaded file or a signature becomes the file the fetch downloaded, or
 *   its name when the download was refused.
 *
 * An answer to a question the form no longer has is kept: its question comes
 * back retired, so its column still exists. A deleted submission is skipped,
 * and a submission served twice (offset paging while a new one arrives) is
 * read once.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  attachmentValue,
  fileNameOfUrl,
  objectsOf,
  oldestFirst,
  plainAnswer,
  plainText,
  textOf,
  type FormAsset,
} from './form-snapshot-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Response = CanonicalForm['responses'][number]

/** Where each answer of a submission goes besides a question column. */
export interface JotformAnswerTargets {
  readonly questions: ReadonlyMap<string, Question>
  /** The questions a calculation fills, by id: their answers are the variable's values. */
  readonly variables: ReadonlyMap<string, { readonly name: string; readonly numeric: boolean }>
  /** The hidden fields, by question id. */
  readonly hidden: ReadonlyMap<string, string>
  /** The question ids that are layout, never an answer. */
  readonly structural: ReadonlySet<string>
  readonly assets: ReadonlyMap<string, FormAsset>
}

const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'control_number',
  'control_spinner',
  'control_scale',
  'control_rating',
  'control_slider',
])

const FILE_TYPES: ReadonlySet<string> = new Set(['control_fileupload', 'control_signature'])

const DATE_TYPES: ReadonlySet<string> = new Set(['control_datetime', 'control_birthdate'])

/** A Jotform envelope's `content`, or the document itself when it is not one. */
export const jotformContent = (json: unknown): unknown =>
  isRecord(json) && 'responseCode' in json ? json['content'] : json

/** A number written as text, or the text when it is none. */
const numberOf = (value: unknown): CanonicalValue | undefined => {
  const text = typeof value === 'number' ? String(value) : textOf(value)?.trim()
  if (text === undefined || text === '') return undefined
  const number = Number(text)
  return Number.isFinite(number) ? number : text
}

/** The text of a compound answer: its `prettyFormat`, else its parts joined. */
const compoundText = (answer: Json, separator: string): string | undefined => {
  const pretty = textOf(answer['prettyFormat'])
  if (pretty !== undefined && pretty.trim() !== '') return plainText(pretty)
  const value = answer['answer']
  if (!isRecord(value)) return undefined
  const parts = Object.values(value)
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part !== '')
  return parts.length === 0 ? undefined : parts.join(separator)
}

const pad = (value: unknown): string => String(value).padStart(2, '0')

/** A date answer as an ISO date: `{ year, month, day }`, or text already starting with one. */
const dateOf = (answer: Json): CanonicalValue | undefined => {
  const value = answer['answer']
  if (isRecord(value) && value['year'] !== undefined && value['month'] !== undefined) {
    return `${String(value['year'])}-${pad(value['month'])}-${pad(value['day'] ?? 1)}`
  }
  const text = textOf(value)?.trim()
  if (text !== undefined && /^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return compoundText(answer, ' ') ?? text
}

/** The files a file answer names, each the downloaded file when the fetch kept it. */
const filesOf = (value: unknown, assets: ReadonlyMap<string, FormAsset>): CanonicalValue => {
  const urls = (Array.isArray(value) ? value : [value]).filter(
    (url): url is string => typeof url === 'string' && url.trim() !== ''
  )
  return urls.map((url) => attachmentValue(assets, url, fileNameOfUrl(url))) as CanonicalValue
}

/** A file answer's files, or none. */
const fileAnswerOf = (
  value: unknown,
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  const files = filesOf(value, assets)
  return Array.isArray(files) && files.length > 0 ? files : undefined
}

/** One answer, in the shape its column holds. */
const valueOf = (
  type: string,
  answer: Json,
  assets: ReadonlyMap<string, FormAsset>
): CanonicalValue | undefined => {
  const value = answer['answer']
  if (value === undefined || value === null || value === '') return undefined
  if (FILE_TYPES.has(type)) return fileAnswerOf(value, assets)
  if (NUMERIC_TYPES.has(type)) return numberOf(value)
  if (DATE_TYPES.has(type)) return dateOf(answer)
  if (type === 'control_address') return compoundText(answer, '\n')
  if (isRecord(value)) return compoundText(answer, ' ') ?? JSON.stringify(value)
  return plainAnswer(value)
}

interface Read {
  readonly response: Response
  readonly retired: readonly Question[]
}

/** One submission as a response, with the retired questions it answers. */
const responseOf = (submission: Json, targets: JotformAnswerTargets): Read => {
  const answers = Object.entries(isRecord(submission['answers']) ? submission['answers'] : {})
    .filter((entry): entry is [string, Json] => isRecord(entry[1]))
    .filter(([id]) => !targets.structural.has(id))
  const retired = answers
    .filter(
      ([id]) => !targets.questions.has(id) && !targets.variables.has(id) && !targets.hidden.has(id)
    )
    .map(([id, answer]) => ({
      sourceId: id,
      title: plainText(textOf(answer['text']) ?? textOf(answer['name']) ?? id) || id,
      sourceType: textOf(answer['type']) ?? 'unknown',
      required: false,
      retired: true,
    }))
  const typeOf = (id: string, answer: Json): string =>
    targets.questions.get(id)?.sourceType ?? textOf(answer['type']) ?? ''
  const read = (pick: (id: string) => boolean) =>
    answers.flatMap(([id, answer]) => {
      if (!pick(id)) return []
      const value = valueOf(typeOf(id, answer), answer, targets.assets)
      return value === undefined ? [] : [[id, value] as const]
    })
  const variables = read((id) => targets.variables.has(id)).map(([id, value]) => {
    const variable = targets.variables.get(id)
    const kept = variable?.numeric === true ? (numberOf(value) ?? value) : value
    return [variable?.name ?? id, kept] as const
  })
  const hidden = read((id) => targets.hidden.has(id)).map(
    ([id, value]) => [targets.hidden.get(id) ?? id, String(value)] as const
  )
  return {
    response: {
      sourceId: String(submission['id']),
      submittedAt: String(submission['created_at'] ?? '').replace(' ', 'T'),
      answers: Object.fromEntries(
        read((id) => !targets.variables.has(id) && !targets.hidden.has(id))
      ),
      ...(hidden.length === 0 ? {} : { hidden: Object.fromEntries(hidden) }),
      ...(variables.length === 0 ? {} : { variables: Object.fromEntries(variables) }),
    },
    retired,
  }
}

/** Every submission of the response pages, oldest first, and the retired questions they answer. */
export const adaptJotformSubmissions = (
  pages: readonly unknown[],
  targets: JotformAnswerTargets
): { readonly responses: readonly Response[]; readonly retired: readonly Question[] } => {
  const submissions = pages
    .flatMap((page) => objectsOf(jotformContent(page)))
    .filter((submission) => submission['status'] !== 'DELETED')
  const read = submissions
    .filter((one, index) => submissions.findIndex((other) => other['id'] === one['id']) === index)
    .map((submission) => responseOf(submission, targets))
  const retired = read.flatMap((one) => one.retired)
  return {
    responses: oldestFirst(read.map((one) => one.response)),
    retired: retired.filter(
      (one, index) => retired.findIndex((other) => other.sourceId === one.sourceId) === index
    ),
  }
}
