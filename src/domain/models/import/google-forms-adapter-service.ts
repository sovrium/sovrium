/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Google Forms adapter: a form (`forms.get`) and its response pages
 * (`forms.responses.list`) into a `CanonicalForm`, pinned under
 * `[internal ref]`.
 *
 * - Each page break starts a section, and each section becomes a page: the
 *   items before the first page break are the first one.
 * - A question's type is its kind, with what changes its column after a dot
 *   (`textQuestion.paragraph`, `dateQuestion.time`, `choiceQuestion.RADIO`).
 * - A grid is one question per row, its choices the grid's columns.
 * - An email the form collects becomes a question of its own.
 *
 * ## Branching
 *
 * A choice option may send the respondent to a section (`goToSectionId`) or
 * end the form (`goToAction: SUBMIT_FORM`) when they leave the section the
 * question sits on: each becomes a `branch` rule, which the mapper turns into
 * the step's `goToWhen` when it goes forward. "Restart the form" has no
 * equivalent and is reported. A section's own "after this section, go to"
 * setting is NOT in the API (`PageBreakItem` has no field), so the sections
 * follow each other in document order, and the report says so.
 *
 * ## What is reported
 *
 * Quiz grading (correct answers, points, feedback) has no Sovrium equivalent:
 * it is reported, and each response's total score is kept in a column.
 * Uploaded files are Google Drive files, read through another API and scope:
 * they are not downloaded, and each answer keeps the file names and Drive ids.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf, readFormSnapshot, textOf } from './form-snapshot-service'
import {
  RESPONDENT_EMAIL_ID,
  TOTAL_SCORE,
  readGoogleFormsResponses,
} from './google-forms-responses-service'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Rule = CanonicalForm['rules'][number]

const SECTION_JUMPS =
  'Google Forms does not expose a section\'s "after this section, go to" setting: the sections are imported in document order, so a respondent who finished one section goes on to the next. Check each section of the original form and add a goToWhen to the step where it jumped elsewhere.'

const QUIZ_GRADING =
  'Quiz grading has no Sovrium equivalent: the correct answers, points and feedback are not imported. Each response keeps its total score in the total_score column.'

const DRIVE_FILES =
  'Uploaded files are Google Drive files, read through another API and scope, so they were not downloaded: each answer keeps the file names and their Drive ids. Copy the files from Drive if you need them.'

const RESTART =
  'A Google Forms option that restarts the form has no Sovrium equivalent; the respondent goes on to the next step instead.'

/** The kinds whose settings change the column, and the suffix each setting adds. */
const SUFFIXED: Readonly<Record<string, (settings: Json) => string>> = {
  choiceQuestion: (settings) => `.${String(settings['type'] ?? 'RADIO')}`,
  textQuestion: (settings) => (settings['paragraph'] === true ? '.paragraph' : ''),
  dateQuestion: (settings) => {
    if (settings['includeYear'] === false) return '.noYear'
    return settings['includeTime'] === true ? '.time' : ''
  },
  timeQuestion: (settings) => (settings['duration'] === true ? '.duration' : ''),
}

const KINDS = [
  'choiceQuestion',
  'textQuestion',
  'dateQuestion',
  'timeQuestion',
  'scaleQuestion',
  'ratingQuestion',
  'fileUploadQuestion',
  'rowQuestion',
] as const

/** The type key of one question, as the question table spells it. */
const sourceTypeOf = (question: Json): string => {
  const kind = KINDS.find((one) => isRecord(question[one]))
  if (kind === undefined) return 'unknown'
  const settings = question[kind]
  return `${kind}${SUFFIXED[kind]?.(isRecord(settings) ? settings : {}) ?? ''}`
}

/** The labelled options of a choice: an "Other" option has no label and is left out. */
const optionsOf = (choice: unknown): readonly Json[] =>
  objectsOf(isRecord(choice) ? choice['options'] : undefined).filter(
    (option) => option['isOther'] !== true && typeof option['value'] === 'string'
  )

const questionOf = (item: Json, question: Json, page: string, title?: string): Question => {
  const sourceType = sourceTypeOf(question)
  const scale = isRecord(question['scaleQuestion']) ? question['scaleQuestion'] : undefined
  const rating = isRecord(question['ratingQuestion']) ? question['ratingQuestion'] : undefined
  const choices = optionsOf(question['choiceQuestion']).map((option) => ({
    label: String(option['value']),
  }))
  return {
    sourceId: String(question['questionId'] ?? item['itemId']),
    title: (title ?? textOf(item['title']) ?? '').trim(),
    ...(textOf(item['description']) === undefined
      ? {}
      : { description: String(item['description']) }),
    sourceType,
    required: question['required'] === true,
    ...(choices.length === 0 ? {} : { choices }),
    ...(rating === undefined ? {} : { properties: { steps: rating['ratingScaleLevel'] } }),
    ...(scale === undefined ? {} : { properties: { low: scale['low'], high: scale['high'] } }),
    page,
  }
}

/** One item's questions: a question, or one per row of a grid; none for layout. */
const questionsOfItem = (item: Json, page: string): readonly Question[] => {
  const single = isRecord(item['questionItem']) ? item['questionItem']['question'] : undefined
  if (isRecord(single)) return [questionOf(item, single, page)]
  const group = isRecord(item['questionGroupItem']) ? item['questionGroupItem'] : undefined
  if (group === undefined) return []
  const columns = optionsOf(isRecord(group['grid']) ? group['grid']['columns'] : undefined)
  return objectsOf(group['questions']).map((row) => {
    const rowTitle = isRecord(row['rowQuestion']) ? textOf(row['rowQuestion']['title']) : undefined
    const title = [textOf(item['title'])?.trim(), rowTitle?.trim()].filter(Boolean).join(' - ')
    return {
      ...questionOf(item, row, page, title),
      choices: columns.map((option) => ({ label: String(option['value']) })),
    }
  })
}

/** A text, image or video item: layout, kept as a section of the form. */
const layoutOf = (item: Json, page: string): readonly Question[] => {
  const kind = (['textItem', 'imageItem', 'videoItem'] as const).find((key) => key in item)
  return kind === undefined
    ? []
    : [
        {
          sourceId: String(item['itemId']),
          title: (textOf(item['title']) ?? '').trim(),
          ...(textOf(item['description']) === undefined
            ? {}
            : { description: String(item['description']) }),
          sourceType: kind,
          required: false,
          page,
        },
      ]
}

interface Section {
  readonly id: string
  readonly title?: string
  readonly items: readonly Json[]
}

/** The sections: the items before the first page break, then one per page break. */
const sectionsOf = (formId: string, items: readonly Json[]): readonly Section[] =>
  items.reduce<readonly Section[]>((sections, item) => {
    if ('pageBreakItem' in item) {
      const title = textOf(item['title'])
      return [
        ...sections,
        { id: String(item['itemId']), ...(title === undefined ? {} : { title }), items: [] },
      ]
    }
    const last = sections.at(-1)
    return last === undefined
      ? [{ id: formId, items: [item] }]
      : [...sections.slice(0, -1), { ...last, items: [...last.items, item] }]
  }, [])

/** The branches and restarts the options of a choice question carry. */
const branchesOf = (item: Json): readonly Rule[] => {
  const question = isRecord(item['questionItem']) ? item['questionItem']['question'] : undefined
  if (!isRecord(question)) return []
  const source = String(question['questionId'])
  return optionsOf(question['choiceQuestion']).flatMap((option): readonly Rule[] => {
    const when = {
      combinator: 'and' as const,
      rules: [{ left: { question: source }, operator: 'is', right: option['value'] }],
    }
    const raw = { question: textOf(item['title']) ?? source, option }
    if (typeof option['goToSectionId'] === 'string') {
      return [{ kind: 'branch', source, when, target: option['goToSectionId'], raw }]
    }
    if (option['goToAction'] === 'SUBMIT_FORM') {
      return [{ kind: 'branch', source, when, target: 'end', raw }]
    }
    return option['goToAction'] === 'RESTART_FORM'
      ? [{ kind: 'other', target: source, raw, reason: RESTART }]
      : []
  })
}

/** Whether the form collects each respondent's email. */
const collectsEmail = (settings: Json): boolean => {
  const collection = settings['emailCollectionType']
  return collection === 'VERIFIED' || collection === 'RESPONDER_INPUT'
}

/** The email question, when the form collects each respondent's email. */
const emailQuestion = (settings: Json, page: string): readonly Question[] =>
  collectsEmail(settings)
    ? [
        {
          sourceId: RESPONDENT_EMAIL_ID,
          title: 'Email',
          sourceType: RESPONDENT_EMAIL_ID,
          required: true,
          page,
        },
      ]
    : []

/** The section-level jumps the API cannot show, reported once for a form with sections. */
const sectionJumps = (sections: readonly Section[]): readonly Rule[] =>
  sections.length > 1
    ? [
        {
          kind: 'other',
          raw: {
            setting: 'after section, go to',
            sections: sections.map(
              (section, index) => section.title ?? `section ${String(index + 1)}`
            ),
          },
          reason: SECTION_JUMPS,
        },
      ]
    : []

/** The form's title and introduction. */
const infoOf = (form: Json) => {
  const info = isRecord(form['info']) ? form['info'] : {}
  const title = textOf(info['title'])?.trim() || textOf(info['documentTitle'])?.trim()
  const description = textOf(info['description'])
  return {
    title: title || 'Google form',
    ...(description === undefined ? {} : { description }),
  }
}

/** Read a Google Forms snapshot (or a `forms.get` file) into a `CanonicalForm`. */
export const adaptGoogleFormsSnapshot = (files: ReadonlyMap<string, unknown>): CanonicalForm => {
  const snapshot = readFormSnapshot(files)
  const form = isRecord(snapshot.definition) ? snapshot.definition : {}
  const settings = isRecord(form['settings']) ? form['settings'] : {}
  const formId = String(form['formId'] ?? 'form')
  const items = objectsOf(form['items'])
  const sections = sectionsOf(formId, items)
  const questions = [
    ...emailQuestion(settings, sections[0]?.id ?? formId),
    ...sections.flatMap((section) =>
      section.items.flatMap((item) => [
        ...questionsOfItem(item, section.id),
        ...layoutOf(item, section.id),
      ])
    ),
  ]
  const quiz = isRecord(settings['quizSettings']) && settings['quizSettings']['isQuiz'] === true
  const uploads = questions.some((question) => question.sourceType === 'fileUploadQuestion')
  return {
    tool: 'google-forms',
    sourceId: formId,
    ...infoOf(form),
    questions,
    pages: sections.map((section) => ({
      sourceId: section.id,
      ...(section.title === undefined ? {} : { title: section.title }),
      questions: questions
        .filter((question) => question.page === section.id)
        .map((one) => one.sourceId),
    })),
    rules: [...items.flatMap(branchesOf), ...sectionJumps(sections)],
    hiddenFields: [],
    ...(quiz ? { variables: [{ name: TOTAL_SCORE, kind: 'number' as const }] } : {}),
    notExposed: [...(quiz ? [QUIZ_GRADING] : []), ...(uploads ? [DRIVE_FILES] : [])],
    definitionInferred: false,
    responses: readGoogleFormsResponses(snapshot.pages, questions),
  }
}
