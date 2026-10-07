/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import {
  buildSyntheticSession,
  buildSystemSession,
} from '@/application/use-cases/automations/build-guest-session'
import { updateRecordWithSideEffects } from '@/application/use-cases/tables/record-update-orchestration'
import {
  answersFromLedgerData,
  keptFileAnswers,
} from '@/domain/models/app/forms/form-access-link-service'
import { coerceScalarsForArrayColumns } from './coerce-array-columns'
import { coerceEmptySelectToNull } from './coerce-empty-select'
import { openEditableSubmissionProgram } from './open-form-access-link'
import { findFormByName } from './submit-form'
import { processSubmissionBody } from './submit-form-body'
import { constraintRefusalForField } from './submit-form-constraint-errors'
import { filterTableBoundFields } from './submit-form-field-shaping'
import type { AccessibleFormSubmissionRow } from '@/application/ports/repositories/forms/form-submission-repository'
import type { UpdateWebhookPayload } from '@/application/use-cases/tables/record-update-orchestration'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * The edit link names nothing this form can still change: unknown token, a
 * form without `editAfterSubmit`, or a window that has passed. One error for
 * all three, so the answer (404) cannot tell them apart.
 */
export class FormEditLinkNotFoundError extends Data.TaggedError('FormEditLinkNotFoundError')<{
  readonly formName: string
}> {}

type EditConfig = Parameters<typeof editFormSubmissionProgram>[0]

/**
 * Update the bound row an edited submission wrote, through the one records
 * update path, as the first submission was authored: by its signed-in
 * submitter, or by the system actor for an anonymous one.
 */
const updateBoundRow = (input: {
  readonly app: App
  readonly form: Form
  readonly row: AccessibleFormSubmissionRow
  readonly tableName: string
  readonly mapped: Readonly<Record<string, unknown>>
  readonly processEnv: EditConfig['processEnv']
  readonly isSqlite: boolean
  readonly dispatchWebhooks: EditConfig['dispatchWebhooks']
  readonly forgetDerivedVariants: EditConfig['forgetDerivedVariants']
}) => {
  const { app, form, row, tableName, mapped } = input
  const session =
    row.submitterUserId !== null ? buildSyntheticSession(row.submitterUserId) : buildSystemSession()
  return updateRecordWithSideEffects({
    session,
    app,
    tableName,
    recordId: row.linkedRecordId ?? '',
    fields: coerceScalarsForArrayColumns(
      coerceEmptySelectToNull(filterTableBoundFields(mapped, form), app, tableName),
      app,
      tableName
    ),
    // The form writes with its own authority, as on create: every column it binds.
    userRole: 'admin',
    userGroups: [],
    linkReader: { session, role: 'admin' },
    // Recorded as a form edit: the form, the submission, the fields it changed.
    auditContext: { form: form.name, submission: row.id },
    isSqlite: input.isSqlite,
    processEnv: input.processEnv,
    dispatchWebhooks: input.dispatchWebhooks,
    forgetDerivedVariants: input.forgetDerivedVariants,
  }).pipe(
    // A value refused by a unique, CHECK or NOT NULL rule is reported against its field.
    Effect.catchTag('DatabaseError', (failure) =>
      Effect.fail(constraintRefusalForField(failure) ?? failure)
    ),
    Effect.withSpan('forms.update-edited-bound-row', { attributes: { form: form.name } })
  )
}

/**
 * Save an edit made through a submission's private edit link.
 *
 * The answers go through the same body pipeline as the first submission
 * (defaults, visibility, required fields, formats, calculations), then update
 * the SAME bound row — through the one records update path, so the activity
 * log records the change and the table's record-update automations run — and
 * the SAME ledger row. The form's submit automations are not started again:
 * a correction is not a new submission. Answers the submission id.
 */
export const editFormSubmissionProgram = (config: {
  readonly app: App
  readonly formName: string
  readonly tokenHash: string
  readonly body: Readonly<Record<string, unknown>>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly isSqlite: boolean
  readonly dispatchWebhooks: (payload: UpdateWebhookPayload) => Effect.Effect<void>
  readonly forgetDerivedVariants: (key: string) => void
}) =>
  Effect.gen(function* () {
    const { app, formName, tokenHash } = config
    const form = findFormByName(app, formName)
    if (form === undefined) return yield* new FormEditLinkNotFoundError({ formName })
    const row = yield* openEditableSubmissionProgram({ form, tokenHash })
    if (row === undefined) return yield* new FormEditLinkNotFoundError({ formName })
    const answers = answersFromLedgerData(form, row.data)
    const body = { ...keptFileAnswers(form, app.tables, answers, config.body), ...config.body }
    const mapped = yield* processSubmissionBody(app, form, body, {})
    const tableName = form.submitTo.table
    if (tableName !== undefined && row.linkedRecordId !== null) {
      yield* updateBoundRow({ ...config, form, row, tableName, mapped })
    }
    const repo = yield* FormSubmissionRepository
    yield* repo.updateData({ id: row.id, data: mapped })
    return { submissionId: row.id }
  }).pipe(Effect.withSpan('forms.edit-form-submission', { attributes: { form: config.formName } }))
