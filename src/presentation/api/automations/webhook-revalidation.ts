/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { webhookJson } from './webhook-wire-json'
import type { Context } from 'hono'

/**
 * Conditional GET for a webhook a caller pulls: a weak `ETag` over the answer
 * the run rendered, and `304 Not Modified` with no body when the caller sends
 * that tag back in `If-None-Match`.
 *
 * The tag is taken AFTER the run, over the status and the body bytes the
 * caller would receive — a pure function of the response template and what
 * the run's steps read, so the same answer always carries the same tag. The
 * run still runs on every pull: what it reads is known only once it has read
 * it. Only an answer the automation declared (`webhook/response` or
 * `trigger.response`'s body) is tagged; the default `{ id, status }` names a
 * fresh run each time and would never match, and an answer that may carry a
 * revealed write-only value keeps `no-store` and carries no tag.
 */

/** `Cache-Control` for a tagged answer that declares none: per caller, revalidated. */
const REVALIDATED_CACHE_CONTROL = 'private, no-cache'

/** The answer the run rendered, and whether its body is one the automation declared. */
export interface WebhookAnswer {
  readonly status: number
  readonly body: unknown
  readonly headers: Readonly<Record<string, string>>
  /** The body is declared and may be tagged: never the default body, never a revealing one. */
  readonly revalidates: boolean
}

/** Whether `answer`, made for a request of `method`, carries an `ETag`. */
export const isRevalidatedAnswer = (method: string, answer: WebhookAnswer): boolean =>
  answer.revalidates &&
  method.toUpperCase() === 'GET' &&
  answer.status >= 200 &&
  answer.status < 300

/** The weak tag of an answer: a SHA-256 over its status and its body as sent. */
export const webhookAnswerTag = (status: number, body: unknown): string => {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${String(status)}\n${serializeJsonForScript(body)}`)
    .digest('base64url')
  return `W/"${digest}"`
}

/** The opaque part of a tag, weak or strong: RFC 9110 compares `If-None-Match` weakly. */
const opaqueOf = (tag: string): string => tag.trim().replace(/^W\//, '')

/** Whether an `If-None-Match` header names `tag` (or `*`). */
export const ifNoneMatchHolds = (header: string | undefined, tag: string): boolean => {
  if (header === undefined || header.trim() === '') return false
  const wanted = opaqueOf(tag)
  return header.split(',').some((entry) => entry.trim() === '*' || opaqueOf(entry) === wanted)
}

/** Whether the answer's headers already declare a `Cache-Control`. */
const declaresCacheControl = (headers: Readonly<Record<string, string>>): boolean =>
  Object.keys(headers).some((name) => name.toLowerCase() === 'cache-control')

/** What a `304` repeats of the `200` it stands for (RFC 9110 §15.4.5): never a body header. */
const NOT_MODIFIED_HEADERS: ReadonlySet<string> = new Set([
  'cache-control',
  'content-location',
  'expires',
  'vary',
])

/** The headers of `headers` a `304` carries, with the tag. */
export const notModifiedHeaders = (
  headers: Readonly<Record<string, string>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => NOT_MODIFIED_HEADERS.has(name.toLowerCase()))
  )

/**
 * Answer the webhook's caller: the rendered answer as JSON, tagged when it is
 * a declared `2xx` answer to a pull, and an empty `304` carrying the tag and
 * the cache header when the caller already holds it.
 */
export const answerWebhook = (c: Context, answer: WebhookAnswer): Response => {
  if (!isRevalidatedAnswer(c.req.method, answer)) {
    return webhookJson(c, answer.body, answer.status, answer.headers)
  }
  const tag = webhookAnswerTag(answer.status, answer.body)
  const headers = {
    ...(declaresCacheControl(answer.headers) ? {} : { 'Cache-Control': REVALIDATED_CACHE_CONTROL }),
    ...answer.headers,
    ETag: tag,
  }
  if (ifNoneMatchHolds(c.req.header('If-None-Match'), tag)) {
    return c.body(null, 304, { ...notModifiedHeaders(headers), ETag: tag })
  }
  return webhookJson(c, answer.body, answer.status, headers)
}
