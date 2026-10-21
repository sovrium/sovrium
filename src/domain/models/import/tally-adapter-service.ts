/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Tally adapter: a form (`GET /forms/{id}`, its `blocks[]`) and its
 * submission pages into a `CanonicalForm`, pinned under
 * `[internal ref]`.
 *
 * A Tally form is one flat, ordered list of blocks:
 *
 * - a `TITLE` block labels the input that follows it;
 * - the options of one choice question are separate blocks sharing the
 *   question's `groupUuid`, which is the question's id;
 * - `PAGE_BREAK` blocks cut the form into pages (`page-1`, `page-2`, …);
 * - `HIDDEN_FIELDS` and `CALCULATED_FIELDS` declare the hidden fields and the
 *   variables;
 * - each `CONDITIONAL_LOGIC` block is one rule, evaluated where it sits: its
 *   jumps are taken after the question before it.
 *
 * Submissions are read in `tally-responses-service.ts`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf, plainText, readFormSnapshot, textOf } from './form-snapshot-service'
import { tallyPageId, tallyRulesOf, type TallyLookup } from './tally-logic-service'
import { tallyResponsesOf, type TallyNames } from './tally-responses-service'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]

/** Option blocks, by the question type their group is. */
const OPTION_BLOCKS: ReadonlySet<string> = new Set([
  'MULTIPLE_CHOICE_OPTION',
  'CHECKBOX',
  'DROPDOWN_OPTION',
  'RANKING_OPTION',
  'MULTI_SELECT_OPTION',
  'MATRIX_ROW',
  'MATRIX_COLUMN',
])

/** Blocks that are neither a question nor layout a form shows. */
const DECLARATIONS: ReadonlySet<string> = new Set([
  'FORM_TITLE',
  'PAGE_BREAK',
  'HIDDEN_FIELDS',
  'CALCULATED_FIELDS',
  'CONDITIONAL_LOGIC',
])

const payloadOf = (block: Json): Json => (isRecord(block['payload']) ? block['payload'] : {})

/** What one walk over the blocks collects. */
interface Walk {
  readonly questions: readonly Question[]
  readonly page: number
  readonly title: string | undefined
  /** A block uuid (a title, an option) → the question it belongs to. */
  readonly owners: ReadonlyMap<string, string>
  /** A `PAGE_BREAK` uuid → the page it starts. */
  readonly breaks: ReadonlyMap<string, string>
  /** A logic block uuid → the question before it. */
  readonly anchors: ReadonlyMap<string, string>
  readonly titleBlocks: readonly string[]
}

const pageId = tallyPageId

/** The label a block's question shows: its title block, else its own text. */
const titleOf = (walk: Walk, payload: Json): string => {
  if (walk.title !== undefined) return walk.title
  const placeholder = textOf(payload['placeholder'])
  if (placeholder !== undefined) return placeholder
  const html = textOf(payload['html'])
  return html === undefined ? '' : plainText(html)
}

/** A question first met at this block. */
const newQuestion = (walk: Walk, block: Json, groupType: string): Question => {
  const payload = payloadOf(block)
  const isOption = OPTION_BLOCKS.has(String(block['type']))
  const {
    text: _text,
    index: _index,
    isFirst: _first,
    isLast: _last,
    isRequired,
    ...rest
  } = payload
  return {
    sourceId: String(block['groupUuid'] ?? block['uuid']),
    title: titleOf(walk, payload),
    sourceType: isOption ? groupType : String(block['type']),
    required: isRequired === true,
    ...(payload['allowMultiple'] === true ? { allowMultiple: true } : {}),
    ...(Object.keys(rest).length === 0 ? {} : { properties: rest }),
    page: pageId(walk.page),
  }
}

/** The choice an option block adds to its question. */
const choiceOf = (block: Json): readonly NonNullable<Question['choices']>[number][] => {
  const text = textOf(payloadOf(block)['text'])
  return OPTION_BLOCKS.has(String(block['type'])) && text !== undefined
    ? [{ sourceId: String(block['uuid']), label: text }]
    : []
}

/** A question block folded into the walk: a new question, or one more option of the last. */
const withQuestion = (walk: Walk, block: Json, groupType: string): Walk => {
  const id = String(block['groupUuid'] ?? block['uuid'])
  const choice = choiceOf(block)
  const owners = new Map([
    ...walk.owners,
    [String(block['uuid']), id] as const,
    ...walk.titleBlocks.map((uuid) => [uuid, id] as const),
  ])
  const held = walk.questions.some((question) => question.sourceId === id)
  const questions = held
    ? walk.questions.map((question) =>
        question.sourceId === id
          ? { ...question, choices: [...(question.choices ?? []), ...choice] }
          : question
      )
    : [
        ...walk.questions,
        {
          ...newQuestion(walk, block, groupType),
          ...(choice.length === 0 ? {} : { choices: choice }),
        },
      ]
  return { ...walk, owners, titleBlocks: [], title: held ? walk.title : undefined, questions }
}

/** A title block: the label of the next question. */
const withTitle = (walk: Walk, block: Json): Walk => {
  const payload = payloadOf(block)
  const html = textOf(payload['html']) ?? textOf(payload['title']) ?? ''
  return {
    ...walk,
    title: plainText(html),
    titleBlocks: [...walk.titleBlocks, String(block['uuid'])],
  }
}

/** A page break: the next questions are on the next page. */
const withBreak = (walk: Walk, block: Json): Walk => ({
  ...walk,
  page: walk.page + 1,
  breaks: new Map([...walk.breaks, [String(block['uuid']), pageId(walk.page + 1)]]),
})

/** A logic block: its jumps are taken after the question before it. */
const withLogic = (walk: Walk, block: Json): Walk => {
  const before = walk.questions.at(-1)?.sourceId
  return before === undefined
    ? walk
    : { ...walk, anchors: new Map([...walk.anchors, [String(block['uuid']), before]]) }
}

/** One block, folded into the walk. */
const step = (walk: Walk, block: Json): Walk => {
  const type = String(block['type'])
  if (type === 'TITLE' && block['groupType'] === 'QUESTION') return withTitle(walk, block)
  if (type === 'PAGE_BREAK') return withBreak(walk, block)
  if (type === 'CONDITIONAL_LOGIC') return withLogic(walk, block)
  if (DECLARATIONS.has(type)) return walk
  return withQuestion(walk, block, String(block['groupType'] ?? type))
}

const namesOf = (blocks: readonly Json[], key: 'hiddenFields' | 'calculatedFields') =>
  blocks.flatMap((block) => objectsOf(payloadOf(block)[key]))

/** Whether a JSON document is a Tally form. */
export const isTallyForm = (json: unknown): boolean =>
  isRecord(json) &&
  Array.isArray(json['blocks']) &&
  objectsOf(json['blocks']).length > 0 &&
  objectsOf(json['blocks']).every(
    (block) => typeof block['uuid'] === 'string' && typeof block['groupUuid'] === 'string'
  )

/** Read a Tally snapshot (or a form file) into a `CanonicalForm`. */
export const adaptTallySnapshot = (files: ReadonlyMap<string, unknown>): CanonicalForm => {
  const snapshot = readFormSnapshot(files)
  const form = isRecord(snapshot.definition) ? snapshot.definition : {}
  const blocks = objectsOf(form['blocks'])
  const walk = blocks.reduce(step, {
    questions: [],
    page: 1,
    title: undefined,
    owners: new Map(),
    breaks: new Map(),
    anchors: new Map(),
    titleBlocks: [],
  } satisfies Walk)
  const hidden = namesOf(blocks, 'hiddenFields')
  const calculated = namesOf(blocks, 'calculatedFields')
  const names: TallyNames = {
    hidden: new Map(hidden.map((field) => [String(field['uuid']), String(field['name'])] as const)),
    variables: new Map(
      calculated.map((field) => [String(field['uuid']), String(field['name'])] as const)
    ),
  }
  const lookup: TallyLookup = {
    names,
    breaks: walk.breaks,
    anchors: walk.anchors,
    owners: walk.owners,
    labels: new Map(
      walk.questions.flatMap((question) =>
        (question.choices ?? []).flatMap((choice) =>
          choice.sourceId === undefined ? [] : [[choice.sourceId, choice.label] as const]
        )
      )
    ),
  }
  const rules = tallyRulesOf(lookup, blocks)
  const read = tallyResponsesOf(snapshot.pages, walk.questions, names, snapshot.assets)
  const title =
    textOf(form['name']) ??
    plainText(
      textOf(payloadOf(blocks.find((block) => block['type'] === 'FORM_TITLE') ?? {})['title']) ?? ''
    )
  return {
    tool: 'tally',
    sourceId: String(form['id'] ?? 'form'),
    title: title === '' ? 'Tally form' : title,
    questions: [...walk.questions, ...read.retired],
    pages:
      walk.page > 1
        ? Array.from({ length: walk.page }, (_unused, index) => ({
            sourceId: pageId(index + 1),
            questions: walk.questions
              .filter((question) => question.page === pageId(index + 1))
              .map((question) => question.sourceId),
          }))
        : [],
    rules,
    hiddenFields: hidden.map((field) => String(field['name'])),
    ...(calculated.length === 0
      ? {}
      : {
          variables: calculated.map((field) => ({
            name: String(field['name']),
            ...(typeof field['value'] === 'number' ? { initial: field['value'] } : {}),
            kind: field['type'] === 'TEXT' ? ('text' as const) : ('number' as const),
          })),
        }),
    definitionInferred: false,
    responses: read.responses,
  }
}
