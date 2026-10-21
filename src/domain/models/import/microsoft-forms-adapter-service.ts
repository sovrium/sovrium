/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Microsoft Forms adapter: the responses workbook ("Open results in
 * Excel", or its CSV) into a `CanonicalForm` whose definition is INFERRED,
 * pinned under `[internal ref]`.
 *
 * Microsoft Forms has no API and no definition export: the workbook holds one
 * row per response and one column per question, after a leading block of
 * response details (id, start and completion times, email, name). So:
 *
 * - the leading columns whose header names a response detail (matched
 *   loosely through {@link RESPONSE_DETAILS}, the exact strings being
 *   unpinned) become columns of the responses table, not form fields;
 * - every other column is a question titled by its header, typed by the shared
 *   inference from its answers; a column whose answers are lists closed by
 *   `;` is a multiple choice;
 * - the quiz columns (total points, feedback, a `Points - ` and a
 *   `Feedback - ` column per question) are kept as columns, and grading is
 *   reported.
 *
 * The report says the definition was inferred, and what was recognised: the
 * question types, choice lists, required answers, sections and branching are
 * not in the export.
 */

import { convertCell, inferColumnKind, isEmptyCell, type RawCell } from './inferred-types-service'
import type { CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'

type Question = CanonicalForm['questions'][number]
type Variable = NonNullable<CanonicalForm['variables']>[number]

/** One response detail of the leading block, and the headers it is written as. */
interface ResponseDetail {
  readonly variable: string
  readonly kind: 'text' | 'number'
  readonly headers: readonly string[]
  readonly role?: 'id' | 'completion' | 'email'
}

/**
 * The response details a header may name, compared lower-case with the spaces
 * collapsed. The English strings follow the support articles' wording; the
 * others are the same columns in the export's other common languages.
 */
export const RESPONSE_DETAILS: readonly ResponseDetail[] = [
  { variable: 'id', kind: 'text', headers: ['id', 'identifiant', 'kennung'], role: 'id' },
  {
    variable: 'started_at',
    kind: 'text',
    headers: ['start time', 'heure de début', 'startzeit', 'hora de inicio'],
  },
  {
    variable: 'completed_at',
    kind: 'text',
    headers: ['completion time', 'heure de fin', 'fertigstellungszeit', 'hora de finalización'],
    role: 'completion',
  },
  {
    variable: 'last_modified_at',
    kind: 'text',
    headers: ['last modified time', 'heure de la dernière modification'],
  },
  {
    variable: 'respondent_email',
    kind: 'text',
    headers: ['email', 'e-mail', 'email address', 'adresse de messagerie', 'courrier'],
    role: 'email',
  },
  { variable: 'respondent_name', kind: 'text', headers: ['name', 'nom', 'nombre'] },
  { variable: 'total_points', kind: 'number', headers: ['total points', 'total des points'] },
  { variable: 'quiz_feedback', kind: 'text', headers: ['quiz feedback', 'commentaires du quiz'] },
  { variable: 'grade_posted_at', kind: 'text', headers: ['grade posted time'] },
]

/** The per-question quiz columns, by the prefix of their header. */
const QUIZ_PREFIXES: readonly { readonly prefix: string; readonly kind: 'text' | 'number' }[] = [
  { prefix: 'points - ', kind: 'number' },
  { prefix: 'feedback - ', kind: 'text' },
]

/** The value an anonymous response leaves in the email column. */
const ANONYMOUS = 'anonymous'

const normalised = (header: string): string => header.trim().replace(/\s+/g, ' ').toLowerCase()

const textOfCell = (cell: RawCell): string =>
  cell === undefined || cell === null ? '' : String(cell).trim()

/** A multiple-choice answer: options joined by `;`, the last one closed too. */
const isChoiceList = (cell: RawCell): boolean =>
  typeof cell === 'string' && /;\s*$/.test(cell.trim())

const choicesOf = (cell: RawCell): readonly string[] =>
  textOfCell(cell)
    .split(';')
    .map((choice) => choice.trim())
    .filter((choice) => choice !== '')

/** An Excel date-time serial as an ISO instant. */
const fromSerial = (serial: number): string =>
  new Date(Math.round((serial - 25_569) * 86_400_000)).toISOString().replace('.000Z', 'Z')

const US_DATE_TIME = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

const pad = (value: string): string => value.padStart(2, '0')

/** The matched parts of `M/D/YY H:MM:SS` as an ISO local date-time. */
const fromUsParts = (parts: readonly (string | undefined)[]): string => {
  const [, month = '', day = '', year = '', hour = '0', minute = '0', second = '0'] = parts
  const fullYear = year.length === 2 ? `20${year}` : year
  return `${fullYear}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`
}

/**
 * A time as the workbook writes it: a serial, or `M/D/YY H:MM:SS` (the
 * English export) read month first. Anything else is kept as written.
 */
export const responseTimeOf = (cell: RawCell): string => {
  if (typeof cell === 'number' && Number.isFinite(cell)) return fromSerial(cell)
  const text = textOfCell(cell)
  const match = US_DATE_TIME.exec(text)
  return match === null ? text : fromUsParts(match)
}

/** What one column is: a response detail, a quiz column, or a question. */
type Column =
  | { readonly kind: 'detail'; readonly index: number; readonly detail: ResponseDetail }
  | { readonly kind: 'variable'; readonly index: number; readonly variable: Variable }
  | {
      readonly kind: 'question'
      readonly index: number
      readonly question: Question
      readonly inferred: string
    }

const detailOf = (header: string): ResponseDetail | undefined =>
  RESPONSE_DETAILS.find((detail) => detail.headers.includes(normalised(header)))

const quizColumnOf = (header: string): Variable | undefined => {
  const quiz = QUIZ_PREFIXES.find((one) => normalised(header).startsWith(one.prefix))
  return quiz === undefined ? undefined : { name: header.trim(), kind: quiz.kind }
}

/** Classify the columns: the leading details, then the quiz columns and the questions. */
const columnsOf = (
  header: readonly string[],
  body: readonly (readonly RawCell[])[]
): readonly Column[] => {
  const leading = header.findIndex((label) => detailOf(label) === undefined)
  const end = leading < 0 ? header.length : leading
  return header.map((label, index): Column => {
    const detail = index < end ? detailOf(label) : undefined
    if (detail !== undefined) return { kind: 'detail', index, detail }
    const quiz = quizColumnOf(label)
    if (quiz !== undefined) return { kind: 'variable', index, variable: quiz }
    const values = body.map((row) => row[index])
    const present = values.filter((value) => !isEmptyCell(value))
    const inferred =
      present.length > 0 && present.every(isChoiceList) ? 'choices' : inferColumnKind(values)
    return {
      kind: 'question',
      index,
      inferred,
      question: {
        sourceId: `column-${String(index + 1)}`,
        title: label.trim() || `Question ${String(index + 1)}`,
        sourceType: inferred,
        required: false,
        ...(inferred === 'choices' ? { allowMultiple: true } : {}),
      },
    }
  })
}

/** One question's answer, in the shape its column holds. */
const answerOf = (inferred: string, cell: RawCell): CanonicalValue | undefined => {
  if (isEmptyCell(cell)) return undefined
  if (inferred === 'choices') {
    const choices = choicesOf(cell)
    return choices.length === 0 ? undefined : choices
  }
  return convertCell(inferred as Parameters<typeof convertCell>[0], cell)
}

const variableValue = (kind: 'text' | 'number', cell: RawCell): CanonicalValue | undefined => {
  if (isEmptyCell(cell)) return undefined
  if (kind === 'number') {
    const number = Number(cell)
    return Number.isFinite(number) ? number : textOfCell(cell)
  }
  return textOfCell(cell)
}

/** A response detail's value: a time read as one, an anonymous email left out. */
const detailValue = (detail: ResponseDetail, cell: RawCell): CanonicalValue | undefined => {
  if (detail.role === 'id' || isEmptyCell(cell)) return undefined
  if (detail.role === 'email' && normalised(textOfCell(cell)) === ANONYMOUS) return undefined
  return detail.variable.endsWith('_at') ? responseTimeOf(cell) : variableValue(detail.kind, cell)
}

/** The value one non-question column holds for a row, under its variable's name. */
const variableEntry = (column: Column, row: readonly RawCell[]) => {
  if (column.kind === 'question') return []
  const [name, value] =
    column.kind === 'variable'
      ? [column.variable.name, variableValue(column.variable.kind ?? 'text', row[column.index])]
      : [column.detail.variable, detailValue(column.detail, row[column.index])]
  return value === undefined ? [] : [[name, value] as const]
}

const responseOf = (row: readonly RawCell[], columns: readonly Column[], position: number) => {
  const detail = (role: ResponseDetail['role']) =>
    columns.find((one) => one.kind === 'detail' && one.detail.role === role)?.index
  const at = (index: number | undefined): RawCell => (index === undefined ? undefined : row[index])
  const variables = columns.flatMap((column) => variableEntry(column, row))
  const answers = columns.flatMap((column) => {
    if (column.kind !== 'question') return []
    const value = answerOf(column.inferred, row[column.index])
    return value === undefined ? [] : [[column.question.sourceId, value] as const]
  })
  return {
    sourceId: textOfCell(at(detail('id'))) || `row-${String(position + 1)}`,
    submittedAt: responseTimeOf(at(detail('completion'))),
    answers: Object.fromEntries(answers),
    ...(variables.length === 0 ? {} : { variables: Object.fromEntries(variables) }),
  }
}

/** The report line saying the definition was inferred, and from what. */
const inferredNote = (columns: readonly Column[]): string => {
  const questions = columns.filter((one) => one.kind === 'question').length
  const details = columns.flatMap((one) =>
    one.kind === 'detail'
      ? [one.detail.variable]
      : one.kind === 'variable'
        ? [one.variable.name]
        : []
  )
  return (
    `Microsoft Forms exports responses only, so the form was inferred from the response columns: ${String(questions)} questions, each typed from its answers` +
    (details.length === 0 ? '' : `, and ${details.join(', ')} kept as response details`) +
    '. The question types, choice lists, required answers, sections and branching are not in the export: review the form.'
  )
}

const QUIZ_GRADING =
  'Quiz grading has no Sovrium equivalent: the points and feedback of each response are kept as columns, and the correct answers are not in the export.'

/** Read a Microsoft Forms responses grid (header row first) into a `CanonicalForm`. */
export const adaptMicrosoftFormsGrid = (
  name: string,
  grid: readonly (readonly RawCell[])[]
): CanonicalForm => {
  const [headerRow = [], ...rows] = grid
  const header = headerRow.map(textOfCell)
  const body = rows.filter((row) => row.some((cell) => !isEmptyCell(cell)))
  const columns = columnsOf(header, body)
  const quiz = columns.some(
    (one) =>
      (one.kind === 'variable' && one.variable.kind === 'number') ||
      (one.kind === 'detail' && one.detail.variable === 'total_points')
  )
  return {
    tool: 'microsoft-forms',
    sourceId: name,
    title: name.trim() || 'Microsoft form',
    questions: columns.flatMap((one) => (one.kind === 'question' ? [one.question] : [])),
    pages: [],
    rules: [],
    hiddenFields: [],
    variables: columns.flatMap((one) => {
      if (one.kind === 'variable') return [one.variable]
      if (one.kind === 'detail' && one.detail.role !== 'id') {
        return [{ name: one.detail.variable, kind: one.detail.kind }]
      }
      return []
    }),
    notExposed: [inferredNote(columns), ...(quiz ? [QUIZ_GRADING] : [])],
    definitionInferred: true,
    responses: body.map((row, index) => responseOf(row, columns, index)),
  }
}
