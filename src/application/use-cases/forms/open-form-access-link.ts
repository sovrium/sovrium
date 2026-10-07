/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import {
  DEFAULT_DRAFT_EXPIRES_IN,
  answersFromLedgerData,
  isWithinFormLinkWindow,
} from '@/domain/models/app/forms/form-access-link-service'
import type { AccessibleFormSubmissionRow } from '@/application/ports/repositories/forms/form-submission-repository'
import type { Form } from '@/domain/models/app/forms'

/**
 * Open a resume link: the saved answers, under the form's field names, while
 * the draft lives. An expired draft is deleted on the way — it holds personal
 * data nobody can reach any more. Expired, already used and never issued all
 * answer `undefined`, so the page cannot tell them apart.
 */
export const openResumeDraftProgram = (input: {
  readonly form: Readonly<Form>
  readonly tokenHash: string
}) =>
  Effect.gen(function* () {
    const { form, tokenHash } = input
    if (form.saveAndResume?.enabled !== true) return undefined
    const repo = yield* FormSubmissionRepository
    const draft = yield* repo.findByAccessToken({
      formName: form.name,
      accessTokenHash: tokenHash,
    })
    if (draft === undefined || draft.status !== 'draft') return undefined
    const expiresIn = form.saveAndResume.expiresIn ?? DEFAULT_DRAFT_EXPIRES_IN
    if (!isWithinFormLinkWindow(draft.submittedAt.getTime(), expiresIn)) {
      yield* repo.deleteById({ id: draft.id })
      return undefined
    }
    return answersFromLedgerData(form, draft.data)
  }).pipe(Effect.withSpan('forms.open-resume-draft', { attributes: { form: input.form.name } }))

/**
 * Open an edit link: the submission it was issued for, while the form's
 * `editAfterSubmit.window` — counted from the submission — is still open.
 * Past the window, for a draft, and for a token never issued, `undefined`.
 */
export const openEditableSubmissionProgram = (input: {
  readonly form: Readonly<Form>
  readonly tokenHash: string
}) =>
  Effect.gen(function* () {
    const { form, tokenHash } = input
    if (form.editAfterSubmit === undefined) return undefined
    const repo = yield* FormSubmissionRepository
    const row = yield* repo.findByAccessToken({
      formName: form.name,
      accessTokenHash: tokenHash,
    })
    if (row === undefined || row.status === 'draft') return undefined
    if (!isWithinFormLinkWindow(row.submittedAt.getTime(), form.editAfterSubmit.window)) {
      return undefined
    }
    return row satisfies AccessibleFormSubmissionRow
  }).pipe(
    Effect.withSpan('forms.open-editable-submission', { attributes: { form: input.form.name } })
  )
