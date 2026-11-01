/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a submission led to, for the inbox to triage by: who sent it, the
 * record it wrote into its form's `submitTo` table, the automation runs it
 * started, and a one-line preview of its answers.
 *
 * A page costs three reads whatever its size: the ledger rows of its
 * submissions (sender and record), the runs counted per submission and per
 * record in one grouped read, and nothing else. The preview needs no read at
 * all: its labels are the form's, and its values are the bodies the page
 * already carries when the reveal gate let them through, so a masked preview
 * holds the form's own words and none of what was submitted.
 *
 * The sender is a person's words only: the account's name, else its email, the
 * guest email of a guest submission; never an address, a hash or a user agent.
 */

import { Effect } from 'effect'
import {
  SubmissionRunsRepository,
  type SubmissionRunCount,
  type SubmissionRunsFilter,
} from '@/application/ports/repositories/automations/submission-runs-repository'
import {
  AdminFormsRepository,
  type AdminSubmissionTriageRow,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import { submissionAutomationNames } from '@/domain/models/app/automations/trigger-entries-service'
import {
  answersPreviewOf,
  type AnswerWords,
} from '@/domain/models/app/forms/form-submission-answers-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { FormSubmissionDetailItem } from './form-submissions-overview'
import type { App } from '@/domain/models/app'

/** A text that says something, else `undefined`. */
const said = (text: string | null): string | undefined =>
  text !== null && text.trim().length > 0 ? text : undefined

/** Who sent a submission, as a person reads it, or `undefined` for an anonymous one. */
const submitterOf = (row: AdminSubmissionTriageRow): string | undefined =>
  said(row.submitterName) ?? said(row.submitterEmail) ?? said(row.guestEmail)

/** The record a submission created, or `null` when it created none. */
const linkedRecordOf = (
  row: AdminSubmissionTriageRow | undefined
): { readonly table: string; readonly id: string } | null =>
  row?.linkedRecordTable && row.linkedRecordId
    ? { table: row.linkedRecordTable, id: row.linkedRecordId }
    : null

/** The form a submission was sent through, when the app still declares it. */
const formOf = (app: App, formName: string) => app.forms?.find((form) => form.name === formName)

/**
 * The words a form's answers are read with: its labels in the app's default
 * language, and a readable name for a field that declares no label.
 */
export const answerWordsOf = (app: App): AnswerWords => {
  const lang = app.languages?.default ?? 'en'
  return {
    translate: (text) => resolveTranslationPattern(text, lang, app.languages),
    readableName,
  }
}

/**
 * The runs these submissions of `formName` started: the form automations'
 * runs carrying one of them, and the record automations' runs on the records
 * they created in the form's `submitTo` table.
 */
const runsFilterOf = (
  app: App,
  formName: string,
  rows: readonly AdminSubmissionTriageRow[]
): SubmissionRunsFilter => {
  const table = formOf(app, formName)?.submitTo?.table
  const names = submissionAutomationNames(app.automations, formName, table)
  return {
    formAutomations: names.form,
    submissionIds: rows.map((row) => row.id),
    recordAutomations: names.record,
    recordIds: rows.flatMap((row) =>
      row.linkedRecordTable === table && row.linkedRecordId !== null ? [row.linkedRecordId] : []
    ),
  }
}

/** How many of the counted runs one submission started. */
const runCountOf = (
  counts: readonly SubmissionRunCount[],
  row: AdminSubmissionTriageRow | undefined,
  id: string
): number => {
  const record = linkedRecordOf(row)
  return counts
    .filter(
      (count) =>
        count.submissionId === id ||
        (count.submissionId === null && record !== null && count.recordId === record.id)
    )
    .reduce((total, count) => total + count.runs, 0)
}

/**
 * The form's answer preview of one submission, masked unless its body is on
 * the page; `undefined` when the app no longer declares the form.
 */
type PreviewOf = (item: FormSubmissionDetailItem) => string | undefined

/** The preview reader of `formName`, its form and words resolved once for a whole page. */
const previewReaderOf = (app: App, formName: string): PreviewOf => {
  const form = formOf(app, formName)
  if (form === undefined) return () => undefined
  const words = answerWordsOf(app)
  return (item) => answersPreviewOf(form, item.body, words)
}

/** The sender, the created record, the preview and the run count, under `_admin`. */
const triaged = (
  item: FormSubmissionDetailItem,
  row: AdminSubmissionTriageRow | undefined,
  previewOf: PreviewOf,
  runCount: number
): FormSubmissionDetailItem => {
  const submitter = row === undefined ? undefined : submitterOf(row)
  const answersPreview = previewOf(item)
  return {
    ...item,
    _admin: {
      ...item._admin,
      ...(submitter === undefined ? {} : { submitter }),
      linkedRecord: linkedRecordOf(row),
      ...(answersPreview === undefined ? {} : { answersPreview }),
      runCount,
    },
  }
}

/**
 * One page of a form's submissions, each with who sent it, the record it
 * created, how many runs it started and its answers preview. The values of a
 * preview are read from the bodies the page carries, so they are present
 * exactly when the reveal gate let the bodies through.
 */
export const withSubmissionsTriage = Effect.fn('admin.forms.submissions-triage')(function* (
  app: App,
  formName: string,
  items: readonly FormSubmissionDetailItem[]
) {
  if (items.length === 0) return items
  const rows = yield* (yield* AdminFormsRepository).findSubmissionTriage(
    items.map((item) => item.id)
  )
  const counts = yield* (yield* SubmissionRunsRepository).countRuns(
    runsFilterOf(app, formName, rows)
  )
  const byId = new Map(rows.map((row) => [row.id, row] as const))
  const previewOf = previewReaderOf(app, formName)
  return items.map((item) => {
    const row = byId.get(item.id)
    return triaged(item, row, previewOf, runCountOf(counts, row, item.id))
  })
})

/**
 * One submission with who sent it, the record it created, its preview and
 * every automation run it started, newest first.
 */
export const withSubmissionRuns = Effect.fn('admin.forms.submission-runs')(function* (
  app: App,
  formName: string,
  item: FormSubmissionDetailItem
) {
  const rows = yield* (yield* AdminFormsRepository).findSubmissionTriage([item.id])
  const runs = yield* (yield* SubmissionRunsRepository).listRuns(runsFilterOf(app, formName, rows))
  const entry = triaged(item, rows[0], previewReaderOf(app, formName), runs.length)
  return {
    ...entry,
    _admin: {
      ...entry._admin,
      runs: runs.map((run) => ({
        id: run.id,
        automation: run.automationName,
        status: run.status ?? 'pending',
      })),
    },
  }
})

/**
 * The run-history narrowing to the runs one submission started, or a filter
 * that matches nothing when no submission has that id.
 */
export const submissionRunsFilterFor = Effect.fn('admin.forms.submission-runs-filter')(function* (
  app: App,
  submissionId: string
) {
  const rows = yield* (yield* AdminFormsRepository).findSubmissionTriage([submissionId])
  const formName = rows[0]?.formName
  return formName === undefined || formName === null
    ? { formAutomations: [], submissionIds: [], recordAutomations: [], recordIds: [] }
    : runsFilterOf(app, formName, rows)
})
