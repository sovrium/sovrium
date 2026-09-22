/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every JSON refusal a form submission can receive, in one place.
 *
 * `forms.ts` answers a submission through a chain of small checks — does the
 * request name a form, does that form exist, is it open yet, has it closed, has
 * it hit its cap, did the honeypot trip, is the caller over its rate limit — and
 * each check used to carry its own inline response literal. The result was a
 * file where the availability ladder's interesting line (`instanceof
 * FormClosedError`) was outnumbered four to one by the shape of the body it
 * returned.
 *
 * Two things make this worth its own module rather than a helper at the bottom
 * of `forms.ts`. The availability ladder becomes readable as a ladder; and the
 * `error` slugs sit together, where a drift between two of them is visible.
 * They are load-bearing: `[internal ref]` and
 * `[internal ref]` read `body.error` directly for five of these,
 * so the slugs are UNCHANGED and rewriting them is a spec change owned by
 * `[internal ref]`.
 *
 * What each refusal gained is the canonical `success` / `message` / `code`
 * alongside the slug, so a client has something to branch on other than the
 * slug's spelling, and something to show a human (standing rule E5). The extra
 * keys the availability refusals carry — `opensAt`, `closedAt`, `maxSubmissions`,
 * `currentCount` — are preserved exactly; specs assert on those too.
 *
 * HTML refusals are NOT here. A native `<form action>` submit gets a rendered
 * error page rather than a body, which is a different medium with a different
 * owner (`renderSubmissionErrorHtml`), and folding the two would put templating
 * behind a function named for an envelope.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { Context } from 'hono'

/** The request named no form. */
export const formNameRequired = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'form_name_required',
      message: 'The request names no form',
      code: ApiErrorCode.BAD_REQUEST,
    }),
    400
  )

/** No such form — absence and denial answer identically (S1 anti-enumeration). */
export const formNotFound = (c: Context): Response =>
  c.json(
    errorBody({ error: 'form_not_found', message: 'No such form', code: ApiErrorCode.NOT_FOUND }),
    404
  )

/**
 * The honeypot field was filled.
 *
 * The wording is deliberately vague: naming the honeypot would tell a bot
 * exactly which field to leave alone next time.
 */
export const formHoneypotTripped = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'invalid request',
      message: 'This submission was rejected',
      code: ApiErrorCode.BAD_REQUEST,
    }),
    400
  )

/** Submission before `opensAt`. */
export const formNotYetOpen = (c: Context, opensAt: string): Response =>
  c.json(
    {
      ...errorBody({
        error: 'form not yet open',
        message: 'This form is not accepting submissions yet',
        code: ApiErrorCode.FORBIDDEN,
      }),
      opensAt,
    },
    403
  )

/** Submission after `closesAt`. */
export const formClosed = (c: Context, closedAt: string): Response =>
  c.json(
    {
      ...errorBody({
        error: 'form closed',
        message: 'This form is no longer accepting submissions',
        code: ApiErrorCode.FORBIDDEN,
      }),
      closedAt,
    },
    403
  )

/** Submission past `maxSubmissions`. */
export const formSubmissionLimitReached = (
  c: Context,
  maxSubmissions: number,
  currentCount: number
): Response =>
  c.json(
    {
      ...errorBody({
        error: 'submission limit reached',
        message: 'This form has reached its submission limit',
        code: ApiErrorCode.FORBIDDEN,
      }),
      maxSubmissions,
      currentCount,
    },
    403
  )

/**
 * Over the per-IP or per-form rate limit.
 *
 * The body intentionally does NOT name WHICH limit tripped: telling the caller
 * whether it was `rate_limit_per_ip` or `rate_limit_per_form` tells an attacker
 * which knob to circumvent. The ledger row records the reason for admin
 * visibility instead.
 */
export const formRateLimited = (c: Context, retryAfterSeconds: number): Response =>
  c.json(
    errorBody({
      error: 'rate limit exceeded',
      message: 'Too many submissions — try again shortly',
      code: ApiErrorCode.RATE_LIMITED,
    }),
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  )
