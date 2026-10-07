/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  PROVIDER_LABEL,
  buildEmailApiRequest,
  providerErrorDetail,
  providerMessageId,
  redactSecrets,
  toOutgoingMessage,
  transportSecrets,
} from './email-api-requests'
import type { SendMailOptions } from './nodemailer'
import type { EmailTransport } from '@/domain/models/process-env/email-transport'

/** An HTTP email transport: every one but SMTP. */
export type EmailApiTransport = Exclude<EmailTransport, { readonly kind: 'smtp' }>

/**
 * Bound on one provider request without progress (standing rule E6). Under the automation
 * email action's own 15 s backstop, so the transport's more specific error —
 * "Brevo did not answer within 10000ms" — is the one a run records.
 */
const EMAIL_API_TIMEOUT_MS = 10_000

/**
 * The provider could not be reached, or refused the message.
 *
 * `message` names the provider and, for a refusal, the HTTP status and the
 * provider's own sentence — and never a credential: it is built from the
 * response and redacted against the transport's secrets at this boundary, so
 * nothing downstream (a run record, a log line) has to remember to.
 */
export class EmailApiError extends Data.TaggedError('EmailApiError')<{
  readonly message: string
  readonly status?: number
}> {}

const describeCause = (cause: unknown): string =>
  cause instanceof Error && cause.name === 'AbortError'
    ? `did not answer within ${String(EMAIL_API_TIMEOUT_MS)}ms`
    : `could not be reached (${cause instanceof Error ? cause.message : String(cause)})`

/**
 * Send one message through an HTTP email API. Succeeds with the provider's
 * message id; fails with {@link EmailApiError}.
 *
 * Never retried: a request that timed out may already have been accepted, and
 * a retry would be a second email in the recipient's inbox.
 */
export const sendThroughEmailApi = (
  transport: EmailApiTransport,
  options: Readonly<SendMailOptions>
): Effect.Effect<string, EmailApiError> => {
  const label = PROVIDER_LABEL[transport.kind]
  const secrets = transportSecrets(transport)
  const redact = (text: string): string => redactSecrets(text, secrets)
  return Effect.gen(function* () {
    const request = buildEmailApiRequest(transport, toOutgoingMessage(options), Date.now())
    const { response, body } = yield* Effect.tryPromise({
      // The stall-timeout variant bounds the body read too: an answer whose
      // headers arrive and whose body never does must not hold the send open.
      try: () =>
        withFetchStallTimeout(
          request.url,
          { method: 'POST', headers: request.headers, body: request.body },
          EMAIL_API_TIMEOUT_MS,
          async (answer) => ({ response: answer, body: await answer.text() })
        ),
      catch: (cause) => new EmailApiError({ message: redact(`${label} ${describeCause(cause)}`) }),
    })
    if (!response.ok) {
      const detail = providerErrorDetail(body)
      return yield* new EmailApiError({
        status: response.status,
        message: redact(
          `${label} refused the message with HTTP ${String(response.status)}${detail !== undefined ? `: ${detail}` : ''}`
        ),
      })
    }
    return providerMessageId(body, transport.kind)
  }).pipe(Effect.withSpan('email.send-through-api', { attributes: { provider: transport.kind } }))
}
