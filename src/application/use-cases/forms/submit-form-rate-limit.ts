/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import { effectiveAntiSpam } from '@/domain/models/app/forms/anti-spam-defaults'
import { checkAndRecord, type RateLimitReason } from '@/infrastructure/forms/form-rate-limiter'
import type { Form } from '@/domain/models/app/forms'

/**
 * Submission rejected by the in-process token-bucket rate-limiter.
 *
 * [internal ref]: the route layer maps this
 * to a HTTP 429 with a `Retry-After: <seconds>` header. The ledger row is
 * already written by the time this error surfaces, with `status: 'spam'`
 * and `status_reason: rate_limit_per_ip | rate_limit_per_form` so admins
 * can see why the attempt was blocked.
 */
export class FormRateLimitedError extends Data.TaggedError('FormRateLimitedError')<{
  readonly reason: RateLimitReason
  readonly retryAfterSec: number
}> {}

/**
 * Rate-limit gate. Evaluates BOTH the per-IP-hash and per-form sliding
 * windows; on rejection, records a spam ledger row tagged with the
 * trip reason and fails with {@link FormRateLimitedError}.
 *
 * Honors [internal ref] defaults: a form with no `antiSpam` block still gets
 * `perIp: 10`, `perForm: 1000`, `windowSeconds: 60` via
 * {@link effectiveAntiSpam}. Explicit author overrides win.
 *
 * Runs AFTER the honeypot check so a tripped honeypot doesn't also consume
 * a rate-limit slot — the locked failure-handler order is honeypot → rate
 * limit → availability cap.
 *
 * Privacy: the limiter is keyed on `submitterIpHash`, not the raw IP. When
 * the route boundary can't extract an IP (proxied traffic, no XFF, no
 * real-ip header), it passes an empty-string IP through the hasher so all
 * "anonymous" traffic shares one bucket — defense in depth against an
 * attacker stripping their forwarded-for to bypass the per-IP gate.
 */
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

    // Write a spam ledger row tagged with the trip reason so admins can see
    // why the submission was blocked. The body is preserved (minus
    // honeypot, but the rate-limit path runs after the honeypot gate so the
    // body already excludes `_hp` only if honeypot logic stripped it; here
    // we keep whatever the submitter sent — a future analytics pass may
    // want to know what spammers are posting).
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
  }).pipe(Effect.withSpan('forms.check-rate-limit', { attributes: { form: input.form.name } }))
