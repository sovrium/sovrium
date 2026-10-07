/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import type { Form } from '@/domain/models/app/forms'

/**
 * The private links a successful submission touches, once its rows are
 * written: the edit link it is given (`editAfterSubmit`), and the resume link
 * it was sent from (`saveAndResume`), which it consumes.
 *
 * Both tokens arrive as digests, hashed at the route boundary; the raw token
 * never reaches this layer or the database. A draft is consumed by a hard
 * delete — it holds personal data and has no further use — so the same link
 * then reopens nothing. A token that names no draft of this form is ignored.
 */
export const applySubmissionAccessLinks = (input: {
  readonly form: Readonly<Form>
  readonly submissionId: string | undefined
  readonly editTokenHash: string | undefined
  readonly resumeTokenHash: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, submissionId, editTokenHash, resumeTokenHash } = input
    const repo = yield* FormSubmissionRepository
    if (form.editAfterSubmit !== undefined && editTokenHash !== undefined && submissionId) {
      yield* repo.setAccessTokenHash({ id: submissionId, accessTokenHash: editTokenHash })
    }
    if (form.saveAndResume?.enabled === true && resumeTokenHash !== undefined) {
      const draft = yield* repo.findByAccessToken({
        formName: form.name,
        accessTokenHash: resumeTokenHash,
      })
      if (draft?.status === 'draft') yield* repo.deleteById({ id: draft.id })
    }
  }).pipe(
    Effect.withSpan('forms.apply-submission-access-links', {
      attributes: { form: input.form.name },
    })
  )
