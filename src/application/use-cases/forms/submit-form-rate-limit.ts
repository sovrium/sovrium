/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import { effectiveAntiSpam } from '@/domain/models/app/forms/anti-spam-defaults'
import { checkAndRecord, type RateLimitReason } from '@/infrastructure/forms/form-rate-limiter'
import type { Form } from '@/domain/models/app/forms'

export class FormRateLimitedError extends Data.TaggedError('FormRateLimitedError')<{
  readonly reason: RateLimitReason
  readonly retryAfterSec: number
}> {}

export const checkRateLimit = (input: {
  readonly form: Readonly<Form>
  readonly body: Readonly<Record<string, unknown>>
  readonly submitterIpHash: string
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, body, submitterIpHash, userAgent } = input
    const policy = effectiveAntiSpam(form).rateLimit
    const result = checkAndRecord({
      ipHash: submitterIpHash,
      formName: form.name,
      policy,
    })
    if (result.ok) return

    if (form.submitTo.storeSubmission !== false) {
      const repo = yield* FormSubmissionRepository
      yield* repo.createTopLevel({
        formName: form.name,
        formId: form.id,
        status: 'spam',
        statusReason: result.reason,
        data: { ...body },
        submitterIpHash,
        ...(userAgent !== undefined ? { userAgent } : {}),
      })
    }
    return yield* new FormRateLimitedError({
      reason: result.reason,
      retryAfterSec: result.retryAfterSec,
    })
  })
