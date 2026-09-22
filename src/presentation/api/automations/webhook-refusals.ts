/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every refusal a webhook request can receive, in one place.
 *
 * The gate chain in `webhook-handler.ts` is a sequence of small predicates —
 * does the webhook exist, does it accept this method, does the signature check
 * out, is the caller over its rate limit, does the body match the declared
 * schema — and each one used to carry its own inline response literal. That
 * spread the endpoint's wire vocabulary across five functions and made the gate
 * chain itself hard to read: the interesting line (`if (!isMethod(method))`) was
 * buried under the uninteresting one (the shape of the 405 body).
 *
 * Collecting them here does three things. The gate chain reads as gates again;
 * the vocabulary a webhook caller must handle can be reviewed in one screen;
 * and the `error` slugs — which are the part shipped specs assert on — sit
 * together, where a drift between two of them is visible rather than four
 * hundred lines apart.
 *
 * The slugs are UNCHANGED and must stay so: `[internal ref]`
 * reads `body.error` directly, and rewriting the wire format is a spec change
 * owned by `[internal ref]`. What each refusal gained is the canonical
 * `success` / `message` / `code` alongside it, so a client has something to
 * branch on other than the slug's spelling (standing rule E5).
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { Context } from 'hono'

/** The request named no webhook. */
export const webhookInvalidRequest = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'invalid_request',
      message: 'The request names no webhook',
      code: ApiErrorCode.BAD_REQUEST,
    }),
    400
  )

/**
 * No such webhook — used both for a genuinely absent trigger and for one that
 * is operationally paused, so a paused automation is indistinguishable from a
 * missing one to a caller.
 */
export const webhookNotFound = (c: Context): Response =>
  c.json(
    errorBody({ error: 'not_found', message: 'No such webhook', code: ApiErrorCode.NOT_FOUND }),
    404
  )

/**
 * The webhook exists but does not accept this method.
 *
 * `code` is METHOD_NOT_ALLOWED, which names the refusal. It used to be
 * BAD_REQUEST for want of a union member, and that told the caller its PAYLOAD
 * was wrong — so the indicated repair was to fix the body and resend, which
 * fails identically forever. The repair is to change the verb, and `allowed`
 * says which one.
 */
export const webhookMethodNotAllowed = (
  c: Context,
  method: string,
  allowed: readonly string[]
): Response =>
  c.json(
    {
      ...errorBody({
        error: 'method_not_allowed',
        message: `This webhook does not accept ${method}`,
        code: ApiErrorCode.METHOD_NOT_ALLOWED,
      }),
      allowed,
    },
    405
  )

/** The signature, bearer token or basic credentials did not check out. */
export const webhookUnauthorized = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'unauthorized',
      message: 'Webhook authentication failed',
      code: ApiErrorCode.UNAUTHORIZED,
    }),
    401
  )

/** Over the trigger's declared rate limit. */
export const webhookRateLimited = (c: Context, retryAfterSeconds: number): Response =>
  c.json(
    errorBody({
      error: 'rate_limited',
      message: 'Too many requests to this webhook',
      code: ApiErrorCode.RATE_LIMITED,
    }),
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  )

/**
 * The payload did not match the trigger's declared schema.
 *
 * `scope` distinguishes the body from the query string in the human-readable
 * half only — the slug stays `validation_failed` for both, because that is what
 * `[internal ref]` and the webhook specs read.
 */
export const webhookValidationFailed = (
  c: Context,
  scope: 'body' | 'query',
  errors: readonly unknown[]
): Response =>
  c.json(
    {
      ...errorBody({
        error: 'validation_failed',
        message:
          scope === 'body'
            ? 'The request body does not match the trigger schema'
            : 'The query string does not match the trigger schema',
        code: ApiErrorCode.VALIDATION_ERROR,
      }),
      errors,
    },
    400
  )

/**
 * The lazy automation-registry seed failed.
 *
 * Deliberately a 500 rather than the 404 its neighbour returns: the pre-dispatch
 * gate has already ruled out "no such automation", so reaching here means the
 * registry itself did not come up — an outage an operator must be paged for, not
 * a caller mistake.
 */
export const webhookRegistrySeedFailure = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'internal_error',
      message: 'The automation could not be registered',
      code: ApiErrorCode.INTERNAL_ERROR,
    }),
    500
  )
