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
  formLinkWindowMs,
} from '@/domain/models/app/forms/form-access-link-service'
import type { App } from '@/domain/models/app'

/**
 * Delete the drafts nobody can reopen any more: those past their form's
 * `saveAndResume.expiresIn`, and every draft of a form that no longer offers
 * save-and-resume (removed, or the block turned off). A draft holds personal
 * data, so it is not kept once its link is dead, whether or not anyone ever
 * opens that link again. Answers how many drafts went.
 */
export const purgeExpiredFormDrafts = Effect.fn('forms.purge-expired-form-drafts')(function* (
  app: Readonly<App>,
  now: number = Date.now()
) {
  const repo = yield* FormSubmissionRepository
  const offering = (app.forms ?? []).filter((form) => form.saveAndResume?.enabled === true)
  const expired = yield* Effect.forEach(offering, (form) =>
    repo.deleteDraftsSavedBefore({
      formName: form.name,
      savedBefore: new Date(
        now - formLinkWindowMs(form.saveAndResume?.expiresIn ?? DEFAULT_DRAFT_EXPIRES_IN)
      ),
    })
  )
  const orphaned = yield* repo.deleteDraftsOutside({
    formNames: offering.map((form) => form.name),
  })
  return expired.reduce((sum, count) => sum + count, orphaned)
})
