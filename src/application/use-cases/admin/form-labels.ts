/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the console calls a form, a submission and a page of submissions, in
 * the operator's console language.
 *
 *   - **A form** is named by its `title`, a `$t:` key read in that language,
 *     else by its name made readable (`quote-request` reads `Quote request`).
 *   - **A submission** never says more than the read does. With its answers
 *     revealed it is named by its first text answer, in the form's order — the
 *     rule that names a record. Without them, by the word for a submission and
 *     when it arrived, day-relative on the operator's clock
 *     (`Submission · Today 10:00`, `Réponse · Aujourd’hui 10:00`).
 *   - **A page of submissions** counts every match, not the rows it holds, in
 *     the right noun and number (`1 submission`, `26 réponses`).
 */

import { Effect } from 'effect'
import { BuildFormDetail, BuildFormsList } from '@/application/use-cases/admin/forms-overview'
import { resolveOperatorLanguage } from '@/application/use-cases/admin/operator-language'
import { formatDayRelativeTime } from '@/domain/kernel/format/day-relative-time'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { recordTitleOf } from '@/domain/models/app/tables/record-title-service'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { onDevTimeline } from '@/infrastructure/process/server-boot-instant'
import type { AdminReadRequest } from '@/application/use-cases/admin/admin-read-operation'
import type { FormsListInput } from '@/application/use-cases/admin/forms-overview'
import type { ConsoleLanguage } from '@/application/use-cases/admin/operator-language'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The console's own words for one submission and for several. */
const SUBMISSION_WORDS: Readonly<
  Record<ConsoleLanguage, Readonly<Record<'word' | 'one' | 'many', string>>>
> = {
  en: { word: 'Submission', one: '{n} submission', many: '{n} submissions' },
  fr: { word: 'Réponse', one: '{n} réponse', many: '{n} réponses' },
}

/** The region a console language writes in when the operator's app declares none for it. */
const CONSOLE_LOCALE: Readonly<Record<ConsoleLanguage, string>> = { en: 'en-US', fr: 'fr-FR' }

/** A standalone question's input type, as the record-title rule names the same kind of text. */
const STANDALONE_TITLE_TYPES: Readonly<Record<string, string>> = {
  'short-text': 'single-line-text',
  email: 'email',
  url: 'url',
  phone: 'phone-number',
}

/** A form's name for people: its title in `language`, else its name made readable. */
export const formLabelOf = (app: App, form: Form, language: ConsoleLanguage): string => {
  const title = resolveTranslationPattern(form.title ?? '', language, app.languages).trim()
  return title === '' || title.startsWith('$t:') ? readableName(form.name) : title
}

/** `1 submission`, `26 submissions`, `26 réponses`: the matches, in the right number. */
export const submissionsResultSummary = (total: number, language: ConsoleLanguage): string => {
  const words = SUBMISSION_WORDS[language]
  return (total === 1 ? words.one : words.many).replace(
    '{n}',
    new Intl.NumberFormat(language).format(total)
  )
}

/** The form's questions, in order, that can name a submission, typed as the title rule reads them. */
const titleCandidates = (app: App, form: Form) => {
  const columns =
    app.tables?.find((table) => table.name === form.submitTo?.table)?.fields ?? undefined
  return form.fields.flatMap((field) => {
    if (field.kind === 'standalone') {
      const type = STANDALONE_TITLE_TYPES[field.inputType]
      return type === undefined ? [] : [{ name: field.name, type }]
    }
    if (field.kind !== 'table-field') return []
    const column = columns?.find((candidate) => candidate.name === field.column)
    return column === undefined ? [] : [{ name: field.column, type: column.type }]
  })
}

/** A submission's name for people — see the module header for what each read may reveal. */
export const submissionLabelOf = (
  app: App,
  submission: {
    readonly formName: string
    readonly submittedAt: string
    readonly body?: Readonly<Record<string, unknown>>
  },
  language: ConsoleLanguage
): string => {
  const form = app.forms?.find((candidate) => candidate.name === submission.formName)
  const named =
    submission.body === undefined || form === undefined
      ? ''
      : recordTitleOf(titleCandidates(app, form), { ...submission.body, id: undefined })
  if (named !== '') return named
  const locale =
    app.languages?.supported.find((entry) => entry.code === language)?.locale ??
    CONSOLE_LOCALE[language]
  const when = formatDayRelativeTime(
    submission.submittedAt,
    usableLocale(locale),
    resolveOperatorTimezone(),
    onDevTimeline()
  )
  return `${SUBMISSION_WORDS[language].word} · ${when}`
}

/**
 * What a form says it is for, in `language`: its `description` with a `$t:`
 * key resolved. `undefined` when it declares none, or only a key no language
 * resolves — never an empty string a console would draw as a blank line.
 */
export const formDescriptionOf = (
  app: App,
  form: Form,
  language: ConsoleLanguage
): string | undefined => {
  if (form.description === undefined) return undefined
  const text = resolveTranslationPattern(form.description, language, app.languages).trim()
  return text === '' || text.startsWith('$t:') ? undefined : text
}

/** An item of the forms read, named for people, with what the form says it is for. */
const labelled = <T extends { readonly name: string }>(
  app: App,
  item: T,
  language: ConsoleLanguage
): T & { readonly label: string; readonly description?: string } => {
  const form = app.forms?.find((candidate) => candidate.name === item.name)
  const description = form === undefined ? undefined : formDescriptionOf(app, form, language)
  return {
    ...item,
    label: form === undefined ? readableName(item.name) : formLabelOf(app, form, language),
    ...(description === undefined ? {} : { description }),
  }
}

/** The forms list, each form named in the caller's console language. */
export const readFormsList = Effect.fn('admin.forms.read-forms-list')(function* (
  app: App,
  input: FormsListInput,
  caller: AdminReadRequest
) {
  const outcome = yield* BuildFormsList(app, input)
  if (outcome._tag !== 'Ok') return outcome
  const language = yield* resolveOperatorLanguage(caller)
  const items = outcome.body.items.map((item) => labelled(app, item, language))
  return { _tag: 'Ok', body: { ...outcome.body, items } } as const
})

/** One form, named in the caller's console language. */
export const readFormDetail = Effect.fn('admin.forms.read-form-detail')(function* (
  app: App,
  formName: string,
  caller: AdminReadRequest
) {
  const outcome = yield* BuildFormDetail(app, formName)
  if (outcome._tag !== 'Ok') return outcome
  const language = yield* resolveOperatorLanguage(caller)
  return { _tag: 'Ok', body: labelled(app, outcome.body, language) } as const
})
