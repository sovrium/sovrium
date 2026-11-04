/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `SmsSender` port over a provider's HTTP API.
 *
 * Twilio's Messages API: a POST to the account's `Messages.json` resource under `baseUrl`,
 * a form body (`To`, `From` or `MessagingServiceSid`, `Body`) and HTTP Basic
 * auth `username:password`. The request goes through `guardedFetch`, the
 * guard every address the configuration chooses passes: the host is resolved
 * and judged, each hop is bounded by a timeout, the credential header is
 * dropped on a hop to another origin, and since the body carries a code, a
 * redirect that would re-send it elsewhere is refused rather than followed.
 *
 * Neither the body nor the credential is ever logged: a failure says only
 * the status and the provider's error code.
 */

import { Effect, Layer } from 'effect'
import {
  SmsSendError,
  SmsSender,
  type OutgoingSms,
  type SmsConnection,
} from '@/application/ports/services/sms-sender'
import { guardedFetch, guardedText } from '@/infrastructure/egress/guarded-fetch'

/** One provider call, headers included. */
const PROVIDER_TIMEOUT_MS = 10_000

/** The provider's answer read: a message resource or an error, both small. */
const ANSWER_MAX_BYTES = 64 * 1024

/** A messaging-service id, sent as one rather than as a sender number. */
const MESSAGING_SERVICE_ID = /^MG[0-9a-fA-F]{32}$/

/** The request one message is, for Twilio's Messages API. */
export const twilioMessageRequest = (
  connection: SmsConnection,
  message: OutgoingSms
): { readonly url: string; readonly headers: Record<string, string>; readonly body: string } => {
  const form = new URLSearchParams({ To: message.to, Body: message.body })
  if (message.from !== undefined && message.from !== '') {
    form.set(MESSAGING_SERVICE_ID.test(message.from) ? 'MessagingServiceSid' : 'From', message.from)
  }
  const credential = Buffer.from(`${connection.username}:${connection.password}`).toString('base64')
  return {
    url: `${connection.baseUrl.replace(/\/+$/, '')}/2010-04-01/Accounts/${encodeURIComponent(connection.username)}/Messages.json`,
    headers: {
      Authorization: `Basic ${credential}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  }
}

/** A provider answer, read: the message id, or why nothing was sent. */
export const twilioAnswer = (
  status: number,
  text: string
):
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false
      readonly reason: 'budget-exhausted' | 'failed'
      readonly message: string
    } => {
  const parsed = ((): Readonly<Record<string, unknown>> => {
    try {
      const value: unknown = JSON.parse(text)
      return typeof value === 'object' && value !== null
        ? (value as Readonly<Record<string, unknown>>)
        : {}
    } catch {
      return {}
    }
  })()
  if (status >= 200 && status < 300) {
    return { ok: true, id: typeof parsed['sid'] === 'string' ? parsed['sid'] : '' }
  }
  const code = typeof parsed['code'] === 'number' ? parsed['code'] : undefined
  const message = `HTTP ${String(status)}${code === undefined ? '' : `, provider error ${String(code)}`}`
  return status === 429 || code === 20_429
    ? { ok: false, reason: 'budget-exhausted', message }
    : { ok: false, reason: 'failed', message }
}

const sendThroughTwilio = (connection: SmsConnection, message: OutgoingSms) =>
  Effect.gen(function* () {
    if (connection.baseUrl === '' || connection.username === '' || connection.password === '') {
      return yield* new SmsSendError({
        reason: 'unconfigured',
        message: 'the connection has no address or credential',
      })
    }
    const request = twilioMessageRequest(connection, message)
    const sent = yield* Effect.tryPromise({
      try: () =>
        guardedFetch(
          request.url,
          { method: 'POST', headers: request.headers, body: request.body },
          // The body carries a one-time code: never re-sent to another origin.
          {
            timeoutMs: PROVIDER_TIMEOUT_MS,
            maxBodyBytes: ANSWER_MAX_BYTES,
            bodyCarriesSecret: true,
          }
        ),
      catch: () => new SmsSendError({ reason: 'failed', message: 'the provider is unreachable' }),
    })
    if (!sent.ok) return yield* new SmsSendError({ reason: 'failed', message: sent.message })
    const answer = twilioAnswer(sent.response.status, guardedText(sent.response))
    if (!answer.ok) {
      return yield* new SmsSendError({ reason: answer.reason, message: answer.message })
    }
    return answer.id
  })

export const SmsSenderLive = Layer.succeed(SmsSender, {
  send: (connection, message) =>
    sendThroughTwilio(connection, message).pipe(
      Effect.withSpan('sms.send', { attributes: { provider: connection.provider } })
    ),
})
