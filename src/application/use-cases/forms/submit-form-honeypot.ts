/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import type { Form } from '@/domain/models/app/forms'

export class FormHoneypotTrippedError extends Data.TaggedError('FormHoneypotTrippedError')<{
  readonly message: string
}> {}

const HONEYPOT_FIELD = '_hp'

export const checkHoneypot = (input: {
  readonly form: Readonly<Form>
  readonly body: Readonly<Record<string, unknown>>
  readonly ipAddress: string | undefined
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, body, ipAddress, userAgent } = input
    if (form.antiSpam?.honeypot !== true) return
    const trap = body[HONEYPOT_FIELD]
    if (trap === undefined || trap === null || trap === '') return
    if (form.submitTo.storeSubmission !== false) {
      const repo = yield* FormSubmissionRepository
      const spamData = Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== HONEYPOT_FIELD)
      )
      yield* repo.createTopLevel({
        formName: form.name,
        formId: form.id,
        status: 'spam',
        statusReason: 'honeypot',
        data: spamData,
        ...(ipAddress !== undefined ? { ipAddress } : {}),
        ...(userAgent !== undefined ? { userAgent } : {}),
      })
    }
    return yield* new FormHoneypotTrippedError({ message: 'invalid request' })
  })
