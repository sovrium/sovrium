/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { OutgoingMessage } from './email-api-requests'
import type { SendMailOptions } from './nodemailer'

/**
 * The extra headers of a message (a bulk send's unsubscribe pair, `X-`
 * headers) as the HTTP email APIs carry them, and SES's content shapes.
 */

/** The string-valued extra headers of a message, as every API carries them. */
export const headersOf = (
  options: Readonly<SendMailOptions>
): { readonly headers?: Readonly<Record<string, string>> } => {
  const raw = options.headers
  if (raw === undefined || raw === null || Array.isArray(raw) || typeof raw !== 'object') return {}
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return entries.length === 0 ? {} : { headers: Object.fromEntries(entries) }
}

/** One SES text content, UTF-8. */
export const sesContent = (data: string): Readonly<Record<string, string>> => ({
  Data: data,
  Charset: 'UTF-8',
})

/** The subject, and the extra headers SES carries as a list of name and value. */
export const sesSubjectAndHeaders = (
  message: OutgoingMessage
): Readonly<Record<string, unknown>> => ({
  Subject: sesContent(message.subject),
  ...(message.headers === undefined
    ? {}
    : { Headers: Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value })) }),
})
