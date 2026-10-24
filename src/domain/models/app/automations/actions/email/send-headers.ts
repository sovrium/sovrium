/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/**
 * The extra headers an `email/send` step may add, and the names it may not.
 *
 * An allow-list rather than a deny-list: a header the action does not know
 * could change how the message is routed, signed or displayed, so only names
 * with a known, harmless meaning are accepted — any `X-` header, the mailing
 * list headers of RFC 2369 and RFC 8058, and the threading and auto-reply
 * headers. Everything else is refused when the config is validated, naming the
 * header.
 *
 * `Schema.Record` silently drops a key its key schema rejects, so the names are
 * checked by a filter over the whole map, never by a key schema.
 */

/** Header names an `email/send` step may set, compared without case. */
export const EMAIL_ALLOWED_HEADER_NAMES: ReadonlyArray<string> = [
  'list-id',
  'list-unsubscribe',
  'list-unsubscribe-post',
  'list-help',
  'list-owner',
  'list-archive',
  'list-subscribe',
  'list-post',
  'precedence',
  'auto-submitted',
  'in-reply-to',
  'references',
  'feedback-id',
]

/**
 * Names the action itself owns: each has its own prop, so setting it as a
 * header is refused with a message pointing at that prop.
 */
export const EMAIL_OWNED_HEADER_NAMES: Readonly<Record<string, string>> = {
  from: 'from',
  to: 'to',
  cc: 'cc',
  bcc: 'bcc',
  subject: 'subject',
  'reply-to': 'replyTo',
}

/** Headers the engine writes itself when a step sets `category`. */
export const EMAIL_CATEGORY_MANAGED_HEADER_NAMES: ReadonlyArray<string> = [
  'list-unsubscribe',
  'list-unsubscribe-post',
]

/** At most this many extra headers on one message. */
export const EMAIL_MAX_EXTRA_HEADERS = 20

const HEADER_NAME_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/

/**
 * Why a header name is refused, or `undefined` when it is accepted.
 *
 * Pure, so the schema filter and any later check share one wording.
 */
export const emailHeaderNameRefusal = (name: string): string | undefined => {
  if (!HEADER_NAME_GRAMMAR.test(name)) {
    return `email/send header "${name}" is not a header name (letters, digits and hyphens, at most 64)`
  }
  const lower = name.toLowerCase()
  const owned = EMAIL_OWNED_HEADER_NAMES[lower]
  if (owned !== undefined) {
    return `email/send header "${name}" is set by the action: use \`${owned}\` instead`
  }
  if (lower.startsWith('x-') || EMAIL_ALLOWED_HEADER_NAMES.includes(lower)) return undefined
  return `email/send header "${name}" is not allowed: use an X- header, a List- header, Precedence, Auto-Submitted, In-Reply-To, References or Feedback-ID`
}

/** The `headers` prop of `email/send`: header name to a value filled from the run. */
export const EmailHeadersSchema = Schema.Record(Schema.String, TemplateStringSchema)
  .annotate({
    description:
      "Extra headers for the message, name to value, such as `X-Campaign: '{{trigger.data.campaign}}'` or `List-Id`. Accepted names: any X- header, the List- headers, Precedence, Auto-Submitted, In-Reply-To, References and Feedback-ID; From, To, Cc, Bcc, Subject, Reply-To and every other name are refused when the config is validated. At most 20. A value that would end the line (a carriage return or line feed) fails the step and nothing is sent.",
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((headers) => {
        const names = Object.keys(headers)
        if (names.length > EMAIL_MAX_EXTRA_HEADERS) {
          return `email/send sets ${names.length} headers; at most ${EMAIL_MAX_EXTRA_HEADERS} are allowed`
        }
        const refused = names
          .map((name) => emailHeaderNameRefusal(name))
          .find((refusal) => refusal !== undefined)
        if (refused !== undefined) return refused
        const lower = names.map((name) => name.toLowerCase())
        const twice = names.find((_, index) => lower.indexOf(lower[index] ?? '') !== index)
        if (twice !== undefined) return `email/send header "${twice}" is set twice`
        return true
      })
    )
  )

/**
 * The `category` of a bulk send: the list a recipient can leave. A literal
 * slug written in the config, never filled from the run, so a request cannot
 * pick the list it unsubscribes from.
 */
export const EmailCategorySchema = Schema.String.annotate({
  description:
    "The mailing list this message belongs to, such as `newsletter` — lower-case letters, digits and hyphens, written in the config. Setting it makes the message a bulk send: it carries a one-click unsubscribe link (the List-Unsubscribe and List-Unsubscribe-Post headers) for this recipient and this category, and a recipient who left the category, or whose address bounced or complained, is skipped instead of mailed. The link is built from BASE_URL, the app's public address (set it in production: without it the link points at the address the server listens on). Refused with cc or bcc, since each recipient gets their own link.",
}).pipe(Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,62}$/)))
