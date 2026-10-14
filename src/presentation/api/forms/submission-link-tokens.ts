/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findFormByName } from '@/application/use-cases/forms/submit-form'
import { hashAccessToken, issueAccessToken } from '@/infrastructure/forms/access-token'
import { editPathOf, resumeTokenOf } from '@/presentation/api/forms/access-link-handlers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The private links a submission touches. A form with `editAfterSubmit` hands
 * each submission an edit link, minted here; a submission sent from a resume
 * link (`?resume=`) consumes that draft. Only digests reach the program; the
 * edit token itself leaves only in the answer, as the link.
 */
export function submissionLinkTokens(c: Context, app: App, formName: string) {
  const editToken =
    findFormByName(app, formName)?.editAfterSubmit === undefined ? undefined : issueAccessToken()
  const resumeToken = resumeTokenOf(c)
  return {
    hashes: {
      ...(editToken === undefined ? {} : { editTokenHash: editToken.hash }),
      ...(resumeToken === undefined ? {} : { resumeTokenHash: hashAccessToken(resumeToken) }),
    },
    editUrlFor: (submissionId: string | null): { readonly editUrl?: string } =>
      editToken === undefined || submissionId === null
        ? {}
        : { editUrl: editPathOf(formName, editToken.token) },
  }
}
