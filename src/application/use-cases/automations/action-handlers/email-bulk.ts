/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { EmailDeliverabilityRepository } from '@/application/ports/repositories/automations/email-deliverability-repository'
import { EmailLinkTokens } from '@/application/ports/services/email-link-tokens'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import {
  EMAIL_MAX_EXTRA_HEADERS,
  emailHeaderNameRefusal,
} from '@/domain/models/app/automations/actions/email/send-headers'
import type { ActionOutcome } from './shared'

/**
 * The bulk half of `email/send`: what a step with a `category`, a `campaign`
 * or `trackOpens` adds to an ordinary send.
 *
 * - the extra `headers`, refused when a filled value would end the line;
 * - for a `category`, the suppression check (a suppressed recipient is a
 *   `skipped` step, the run goes on) and the one-click unsubscribe pair;
 * - for `trackOpens`, one pixel at the end of the HTML part;
 * - a message row (no address) that `email/stats` counts.
 */

/** The services a bulk or tracked send reaches beyond the mailer. */
export type EmailBulkRequirements = EmailDeliverabilityRepository | EmailLinkTokens | ServerOrigin

/** The most a filled `campaign` may hold. */
const MAX_CAMPAIGN_LENGTH = 128

/** What a step's props ask of the bulk machinery. */
export interface BulkIntent {
  readonly category: string | undefined
  readonly campaign: string | undefined
  readonly trackOpens: boolean
  readonly headers: Readonly<Record<string, string>>
}

/** Read the bulk props of an `email/send` step. */
export const bulkIntentOf = (props: Readonly<Record<string, unknown>>): BulkIntent => {
  const text = (key: string): string | undefined => {
    const value = props[key]
    return typeof value === 'string' && value !== '' ? value : undefined
  }
  const rawHeaders = props['headers']
  const headers =
    rawHeaders !== null && typeof rawHeaders === 'object'
      ? Object.fromEntries(
          Object.entries(rawHeaders as Record<string, unknown>).map(([name, value]) => [
            name,
            String(value ?? ''),
          ])
        )
      : {}
  return {
    category: text('category'),
    campaign: text('campaign'),
    trackOpens: props['trackOpens'] === true,
    headers,
  }
}

/** One bare address, the only shape a suppression row or an unsubscribe link names. */
const BARE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/

/**
 * The one address a bulk send goes to, lower-cased — `ann@example.com` or
 * `Ann <ann@example.com>` — or `undefined` when `to` is not exactly one
 * mailbox. The suppression check, the unsubscribe link and erasure all key on
 * the bare address, so a display name or a second address must never reach
 * them as part of the key: it would mail an address that left the list.
 */
export const listRecipientOf = (to: string): string | undefined => {
  const trimmed = to.trim()
  const bracketed = /^[^<>,;]*<([^<>]+)>$/.exec(trimmed)?.[1]
  const address = (bracketed ?? trimmed).trim()
  return BARE_ADDRESS.test(address) ? address.toLowerCase() : undefined
}

const hasRecipients = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== ''

/**
 * Why a bulk send is refused before anything leaves, or `undefined`.
 *
 * Config validation already refuses these shapes, but a step dispatched with
 * final props (a code step's `actions.email.send`, an agent's tool call)
 * never meets the schema, so the runtime re-checks what the schema promises:
 * the header names, a single recipient per bulk message, no copies.
 */
const bulkShapeRefusal = (
  intent: BulkIntent,
  to: string,
  props: Readonly<Record<string, unknown>>
): string | undefined => {
  const names = Object.keys(intent.headers)
  if (names.length > EMAIL_MAX_EXTRA_HEADERS) {
    return `email.send sets ${String(names.length)} headers; at most ${String(EMAIL_MAX_EXTRA_HEADERS)}; nothing was sent`
  }
  const badName = names.map(emailHeaderNameRefusal).find((refusal) => refusal !== undefined)
  if (badName !== undefined) return `${badName}; nothing was sent`
  if (intent.category === undefined) return undefined
  if (listRecipientOf(to) === undefined) {
    return 'email.send with `category` sends to exactly one address, and `to` is not one; nothing was sent'
  }
  if (hasRecipients(props['cc']) || hasRecipients(props['bcc'])) {
    return 'email.send with `category` takes no `cc` or `bcc`; nothing was sent'
  }
  return undefined
}

/**
 * Why the step cannot send as written, or `undefined`: a header value that
 * would end the line (a request smuggling a `Bcc:`), a campaign too long, or a
 * shape the schema refuses (see {@link bulkShapeRefusal}).
 */
export const bulkRefusal = (
  intent: BulkIntent,
  to: string,
  props: Readonly<Record<string, unknown>>
): string | undefined => {
  const broken = Object.entries(intent.headers).find(([, value]) => /[\r\n]/.test(value))
  if (broken !== undefined) {
    return `email.send header "${broken[0]}" contains a line break; nothing was sent`
  }
  if (intent.campaign !== undefined && intent.campaign.length > MAX_CAMPAIGN_LENGTH) {
    return `email.send campaign is ${String(intent.campaign.length)} characters once filled; at most ${String(MAX_CAMPAIGN_LENGTH)}`
  }
  return bulkShapeRefusal(intent, to, props)
}

/** Whether a send records a message row: a bulk or a tracked one. */
const isLedgered = (intent: BulkIntent): boolean =>
  intent.category !== undefined || intent.trackOpens

/** The skip a suppressed recipient's bulk send records; the run goes on. */
const suppressedSkip = (category: string): ActionOutcome => {
  const reason = `recipient is suppressed for category "${category}"`
  return { status: 'success', skipped: reason, output: { skipped: true, reason } }
}

/**
 * The skip outcome when the recipient left `intent.category` (or every
 * category), else `undefined`. A send without a category is never skipped.
 */
const suppressionSkip = (
  to: string,
  intent: BulkIntent
): Effect.Effect<ActionOutcome | undefined, never, EmailDeliverabilityRepository> =>
  Effect.gen(function* () {
    const { category } = intent
    if (category === undefined) return undefined
    const repo = yield* EmailDeliverabilityRepository
    const address = listRecipientOf(to) ?? to.trim().toLowerCase()
    const suppressed = yield* repo.suppressedAmong({ addresses: [address], category }).pipe(
      Effect.tapCause((cause) => Effect.logError('email.send suppression lookup failed', cause)),
      // effect-swallow: a list that cannot be read must not mail someone who left it, so
      // the read failing is answered as "suppressed": the step skips rather than sends.
      Effect.orElseSucceed(() => new Set([address]))
    )
    return suppressed.has(address) ? suppressedSkip(category) : undefined
  })

/** What a ledgered send adds to the message: its reference, headers and pixel. */
export interface BulkDecoration {
  readonly ref: string | undefined
  readonly headers: Readonly<Record<string, string>>
  readonly appendHtml: string
}

/** The headers, the reference and the pixel one recipient's message carries. */
export const decorateBulk = (
  to: string,
  intent: BulkIntent
): Effect.Effect<BulkDecoration, never, EmailLinkTokens | ServerOrigin> =>
  Effect.gen(function* () {
    if (!isLedgered(intent)) return { ref: undefined, headers: intent.headers, appendHtml: '' }
    const ref = crypto.randomUUID()
    const tokens = yield* EmailLinkTokens
    const base = yield* (yield* ServerOrigin).current
    const unsubscribe: Readonly<Record<string, string>> =
      intent.category === undefined
        ? {}
        : {
            'List-Unsubscribe': `<${base}/api/email/unsubscribe?token=${tokens.sealUnsubscribe({
              address: listRecipientOf(to) ?? to.trim().toLowerCase(),
              category: intent.category,
              ref,
            })}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
    const pixel = intent.trackOpens
      ? `<img src="${base}/api/email/open/${tokens.sealOpen(ref)}" width="1" height="1" alt="" style="display:none">`
      : ''
    return { ref, headers: { ...intent.headers, ...unsubscribe }, appendHtml: pixel }
  }).pipe(Effect.withSpan('automations.email-bulk-decorate'))

/** Record the message a ledgered send sent; a ledger write failing never fails the send. */
export const recordSent = (
  decoration: BulkDecoration,
  intent: BulkIntent,
  messageId: string
): Effect.Effect<void, never, EmailDeliverabilityRepository> =>
  Effect.gen(function* () {
    if (decoration.ref === undefined) return
    const repo = yield* EmailDeliverabilityRepository
    yield* repo
      .recordMessage({
        ref: decoration.ref,
        messageId,
        category: intent.category,
        campaign: intent.campaign,
      })
      .pipe(
        Effect.tapCause((cause) =>
          Effect.logError('email.send message ledger write failed', cause)
        ),
        // effect-swallow: the message has already left; a missing ledger row only
        // under-counts `email/stats`, which the manual calls a lower bound.
        Effect.ignore
      )
  }).pipe(Effect.withSpan('automations.email-bulk-record-sent'))

/**
 * The bulk checks a send makes before anything else: the step's intent, or
 * the outcome that ends it — a refusal (a header line break, a campaign too
 * long) or the skip of a suppressed recipient.
 */
export const bulkPrelude = (
  to: string,
  props: Readonly<Record<string, unknown>>
): Effect.Effect<
  { readonly intent: BulkIntent } | { readonly outcome: ActionOutcome },
  never,
  EmailDeliverabilityRepository
> =>
  Effect.gen(function* () {
    const intent = bulkIntentOf(props)
    const refusal = bulkRefusal(intent, to, props)
    if (refusal !== undefined) {
      return { outcome: { status: 'failure', error: refusal, retryable: false } as const }
    }
    const skip = yield* suppressionSkip(to, intent)
    return skip === undefined ? { intent } : { outcome: skip }
  }).pipe(Effect.withSpan('automations.email-bulk-prelude'))
