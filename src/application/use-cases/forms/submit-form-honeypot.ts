/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import { effectiveAntiSpam } from '@/domain/models/app/forms/anti-spam-defaults'
import type { Form } from '@/domain/models/app/forms'

/**
 * Submission rejected by the honeypot anti-spam check (`antiSpam.honeypot:
 * true` and the hidden `_hp` field was filled). Surfaces as 400 `{ error:
 * 'invalid request' }` — the generic message never leaks the spam reason to
 * the client. The submission is still recorded in the ledger with
 * `status: 'spam'`, `statusReason: 'honeypot'`, so spam never consumes a
 * `maxSubmissions` cap slot (its status is excluded from the cap counter).
 */
export class FormHoneypotTrippedError extends Data.TaggedError('FormHoneypotTrippedError')<{
  readonly message: string
}> {}

/**
 * Conventional name of the hidden honeypot input. Bots fill every field; a
 * non-empty value here flags the submission as spam.
 */
const HONEYPOT_FIELD = '_hp'

/**
 * Honeypot anti-spam gate. When `antiSpam.honeypot` is enabled (or defaulted
 * to true via [internal ref]) and the hidden `_hp` field was filled, record a
 * `spam` ledger row (so the response view shows it, but the cap counter
 * ignores it) then fail with {@link FormHoneypotTrippedError}. A no-op when
 * honeypot is explicitly disabled (`antiSpam.honeypot: false`) or the field
 * is empty/absent.
 *
 * Runs against the RAW submitter body (before the visibility/declared-field
 * filters strip the `_hp` field, which the form never declares).
 *
 * [internal ref] + S5: the ledger row stores the SHA-256(salt + ip) hash in
 * `submitter_ip_hash` — the raw IP never lands in `ip_address` on the
 * top-level forms path.
 */
export const checkHoneypot = (input: {
  readonly form: Readonly<Form>
  readonly body: Readonly<Record<string, unknown>>
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, body, submitterIpHash, userAgent } = input
    // [internal ref]: defaults are `honeypot: true` when antiSpam is absent.
    if (effectiveAntiSpam(form).honeypot !== true) return
    const trap = body[HONEYPOT_FIELD]
    if (trap === undefined || trap === null || trap === '') return
    // Record the spam attempt in the ledger (status excluded from the cap),
    // then reject with the generic message. The honeypot value itself is
    // dropped so it never lands in the persisted `data`.
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
        ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
        ...(userAgent !== undefined ? { userAgent } : {}),
      })
    }
    return yield* new FormHoneypotTrippedError({ message: 'invalid request' })
  }).pipe(Effect.withSpan('forms.check-honeypot', { attributes: { form: input.form.name } }))
