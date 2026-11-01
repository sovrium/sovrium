/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The budgets kept per email ADDRESS on the auth routes, beside the
 * per-client rows of `auth-route-utils.ts`. A per-client row alone lets one
 * caller spread its requests across routes (each has its own row) or across
 * client addresses; these follow the address the request names instead.
 *
 * - **One send budget** shared by every route that mails a sign-in or
 *   recovery code or link to the address in the body: at most
 *   {@link ADDRESS_SEND_BUDGET} mails per address per rate-limit window,
 *   whichever routes asked for them.
 * - **A lock on code guesses**: {@link CODE_ATTEMPT_BUDGET} attempts at an
 *   emailed one-time code for one address that do not succeed, across every
 *   route that checks one, and that address is refused further attempts until
 *   the oldest of them is {@link CODE_ATTEMPT_WINDOW_MS} old. An attempt counts
 *   when it STARTS, before the code is looked at, so guesses sent in parallel
 *   cannot all reach the check before the first is answered: this is also what
 *   caps the attempts that run side by side. A right code clears the
 *   address's count, like the two-step lock does.
 * - **One code check at a time per address**, so the dependency's own limit of
 *   attempts per code holds when guesses arrive together (see
 *   {@link oneAtATime}).
 *
 * Both refusals are the shared 429 envelope with a `Retry-After`
 * (`RATE_LIMITED` for the send budget, `TOO_MANY_CODE_ATTEMPTS` for the lock), sent
 * before Better Auth runs, so a refused send mails nothing and a refused guess
 * checks nothing. The counts are in this process's memory, as every other
 * auth budget is.
 */

import { Option, Schema } from 'effect'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import {
  rateLimitedResponse,
  tooManyRequestsResponse,
} from '@/presentation/api/runtime/rate-limit-response'
import { getRateLimitWindowMs } from './auth-route-utils'
import type { Context, Hono, Next } from 'hono'

/** Mails one address may be sent per rate-limit window, all sending routes together. */
export const ADDRESS_SEND_BUDGET = 5

/** Code attempts one address may make without a success before the lock. */
export const CODE_ATTEMPT_BUDGET = 10

/** How long a failed code attempt counts toward the lock: fifteen minutes. */
export const CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

/** The message of the code-guess lock's 429. */
export const CODE_ATTEMPTS_MESSAGE =
  'Too many codes tried for this address. Please try again later.'

/** The routes that mail a sign-in or recovery code or link to the body's `email`. */
export const ADDRESS_SEND_PATHS: readonly string[] = [
  '/api/auth/sign-in/magic-link',
  '/api/auth/email-otp/send-verification-otp',
  '/api/auth/email-otp/request-password-reset',
  '/api/auth/forget-password/email-otp',
  '/api/auth/request-password-reset',
  '/api/auth/send-verification-email',
]

/** The routes that check an emailed one-time code for the body's `email`. */
export const CODE_CHECK_PATHS: readonly string[] = [
  '/api/auth/sign-in/email-otp',
  '/api/auth/email-otp/check-verification-otp',
  '/api/auth/email-otp/verify-email',
  '/api/auth/email-otp/reset-password',
]

const sendLimiter = createSlidingWindowLimiter()
const attemptLimiter = createSlidingWindowLimiter()

const decodeEmailBody = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ email: Schema.String }))
)

/**
 * The address a request names, as the budgets key it: trimmed and lower-cased,
 * the way Better Auth stores and compares it. `undefined` when the body names
 * none; such a request is Better Auth's to refuse.
 */
export const budgetAddressOf = (body: string): string | undefined =>
  Option.match(decodeEmailBody(body), {
    onNone: () => undefined,
    onSome: ({ email }) => {
      const address = email.trim().toLowerCase()
      return address === '' ? undefined : address
    },
  })

/** Read the body from a CLONE: Better Auth reads the original after this. */
const addressOf = async (c: Context): Promise<string | undefined> =>
  budgetAddressOf(await c.req.raw.clone().text())

const guardSend = async (c: Context, next: Next) => {
  const address = await addressOf(c)
  if (address !== undefined) {
    const decision = sendLimiter.consume(address, {
      windowMs: getRateLimitWindowMs(),
      maxRequests: ADDRESS_SEND_BUDGET,
    })
    if (decision.limited) return rateLimitedResponse(c, decision.retryAfter)
  }
  await next()
  return undefined
}

/** The tail of each address's queue of code checks, while one is running. */
const codeCheckQueues = new Map<string, Promise<unknown>>()

/**
 * Run `check` once every earlier code check for `address` has been answered.
 * Better Auth counts a code's wrong attempts by reading the count and writing
 * it back; on PostgreSQL, checks of one code running side by side all read the
 * same count, so the code's own attempt limit stopped nothing (sixty parallel
 * guesses were all checked, and the stored count ended at one). One at a time
 * per address, each check reads the count the previous one wrote.
 */
const oneAtATime = async (address: string, check: () => Promise<void>): Promise<void> => {
  const previous = codeCheckQueues.get(address) ?? Promise.resolve()
  const current = previous.then(check)
  // The queue's tail never rejects: a failed check must not fail the next one.
  const tail = current.catch(() => undefined)
  codeCheckQueues.set(address, tail)
  try {
    await current
  } finally {
    if (codeCheckQueues.get(address) === tail) codeCheckQueues.delete(address)
  }
}

const guardCodeAttempt = async (c: Context, next: Next) => {
  const address = await addressOf(c)
  if (address === undefined) {
    await next()
    return undefined
  }
  const decision = attemptLimiter.consume(address, {
    windowMs: CODE_ATTEMPT_WINDOW_MS,
    maxRequests: CODE_ATTEMPT_BUDGET,
  })
  if (decision.limited) {
    return tooManyRequestsResponse(c, {
      message: CODE_ATTEMPTS_MESSAGE,
      code: 'TOO_MANY_CODE_ATTEMPTS',
      retryAfterSeconds: decision.retryAfter,
    })
  }
  await oneAtATime(address, next)
  // A right code settles the address: the attempts before it stop counting.
  if (c.res.status >= 200 && c.res.status < 300) attemptLimiter.forget(address)
  return undefined
}

/**
 * Mount the per-address budgets. Registered after the per-client rows, so a
 * request those refuse never draws on the address's budget.
 */
export const applyAuthAddressBudgetMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const withSends = ADDRESS_SEND_PATHS.reduce<Readonly<Hono>>(
    (app, path) => app.use(path, guardSend),
    honoApp
  )
  return CODE_CHECK_PATHS.reduce<Readonly<Hono>>(
    (app, path) => app.use(path, guardCodeAttempt),
    withSends
  )
}
