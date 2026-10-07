/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { sanitizeError, getStatusCode } from './error-sanitizer'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Result, Schema } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * What a route program may fail with and have `sanitizeError` classify: an
 * `Error` (a `Data.TaggedError`, a driver failure, a plain `Error`) or a plain
 * tagged object (`{ _tag: 'NotFoundError', ... }`). The `_tag` is what picks
 * the status; everything else falls to the driver classification or the
 * generic 500.
 */
type RouteFailure = Error | { readonly _tag: string }

/**
 * Render ANY error as the canonical Sovrium error envelope, sanitized.
 *
 * This is the composable half of {@link runEffect}, and it exists because
 * `runEffect` cannot serve most of the route tree. `runEffect` owns the WHOLE
 * response — it runs the program, maps a failure, and shapes the success — so a
 * handler that branches on `_tag` and then *continues* with the success value
 * can never reach its error rendering. That is the majority of
 * `_tag === 'Failure'` branches under `src/presentation/api/routes/`, and
 * without this helper each would hand-roll an envelope.
 *
 * Use it as the LAST rung of a semantic ladder, never as the ladder itself:
 *
 * ```ts
 * if (failure._tag === 'SlugTaken') return conflict(c, 'That slug is already taken')
 * if (failure._tag === 'NotYetOpen') return forbidden(c, 'This form is not open yet')
 * return toErrorResponse(c, failure) // everything the route has no opinion about
 * ```
 *
 * There is deliberately NO global tag → status table behind this, and there must
 * not be one: a route may map one and the same tag to 400 on create and 404 on
 * update, and be right to. The status answers "what did the CALLER get
 * wrong", which the route knows and a table cannot. What this function owns is
 * the part no route should re-decide — `sanitizeError`'s classification (tagged
 * errors, driver failures, the S1 anti-enumeration 404), the server-side logging
 * of the full cause, and the envelope shape.
 *
 * It never throws. The envelope is decoded through {@link decodeSafe} rather
 * than `decodeOrThrow` precisely because this is the last thing standing between
 * a failure and the client: a throw here escapes a `catch` that has nowhere left
 * to send it. A decode miss is logged and the undecoded envelope is sent, which
 * is strictly better than a naked 500 with no body.
 */
export function toErrorResponse(c: Context, error: unknown): Response {
  // Request ID for error correlation — set by the `hono/request-id` middleware
  // (mounted first in `createHonoApp`). Falls back to a fresh UUID only if the
  // middleware was not mounted (e.g. an isolated test harness).
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID()

  // Sanitize error (removes internal details, logs full error server-side)
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  const errorData = {
    success: false as const,
    error: sanitized.error,
    message: sanitized.message ?? sanitized.error,
    code: sanitized.code,
    ...(sanitized.details ? { details: sanitized.details } : {}),
    // Both keys must also be DECLARED on `errorResponseSchema`: the decode below
    // is a bare object schema, so an undeclared key is stripped silently and
    // the attribution would vanish between here and the wire.
    ...(sanitized.field ? { field: sanitized.field } : {}),
    ...(sanitized.errors ? { errors: sanitized.errors } : {}),
  }

  const decoded = decodeSafe(errorResponseSchema)(errorData)
  if (!decoded.success) {
    logError(
      `[API Error] the error envelope failed its own contract requestId=${requestId}`,
      decoded.error
    )
    return c.json(errorData, statusCode)
  }
  return c.json(decoded.data, statusCode)
}

/**
 * Shape a program's outcome into a response, as an Effect that cannot fail.
 *
 * The composable half of {@link runEffect}: a handler that must do more than
 * one thing — gate, then write, then answer — composes this into ITS program
 * and runs the whole on one runtime with {@link runHandlerEffect}, instead of
 * running each step on a fresh root fiber with its own services.
 *
 * A failure becomes the sanitized envelope ({@link toErrorResponse}); a success
 * is validated against `schema` when one is given. A response-schema mismatch is
 * a broken CONTRACT — this route computed a value its own published schema
 * rejects — so it is logged with the failing path and answered with the
 * canonical 500: a half-valid body must never reach the wire.
 */
export function respondWith<T, E, R, S extends Schema.Top = Schema.Top>(
  c: Context,
  program: Effect.Effect<T, E, R>,
  schema?: S,
  successStatus: number = 200
): Effect.Effect<Response, never, R> {
  return Effect.match(program, {
    onFailure: (failure) => toErrorResponse(c, failure),
    onSuccess: (value) => {
      if (!schema) return c.json(value, successStatus as ContentfulStatusCode)
      const validated = decodeSafe(schema)(value)
      if (validated.success) return c.json(validated.data, successStatus as ContentfulStatusCode)
      const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
      // The path goes in the MESSAGE, not in the cause: a `SchemaError` carries
      // no message on its stack header, so passing it as the cause alone would
      // log a bare `Error` and lose the attribution (measured on effect@4.0.0).
      logError(
        `[API Error] response failed its schema at ${c.req.method} ${c.req.path} requestId=${requestId}: ${validated.error.message}`,
        validated.error
      )
      return toErrorResponse(c, validated.error)
    },
  })
}

/**
 * Run a handler's WHOLE program once, on the request's services, under the
 * request-edge `http.server` span.
 *
 * The program has already turned every failure it knows about into a
 * `Response` (see {@link respondWith}); what is left to catch here is a defect,
 * which is rendered through the same sanitized envelope. One call per handler
 * is the point: every step then shares one fiber, one set of services and one
 * trace, which is what lets a transaction span the handler.
 */
export async function runHandlerEffect(
  c: Context,
  program: Effect.Effect<Response, never, DomainServices>
): Promise<Response> {
  try {
    return await runRequestEffect(c, provideDomain(c, program))
  } catch (error) {
    return toErrorResponse(c, error)
  }
}

/**
 * Run one step of a handler that has not yet been composed into a single
 * program, on the request's services and under its span, resolving the
 * program's `Result`. Prefer {@link runHandlerEffect} over a handler's whole
 * program: this exists so the remaining steps at least share the request's
 * runtime instead of each building its own layers.
 */
export async function runOnRequest<A, E>(
  c: Context,
  program: Effect.Effect<A, E, DomainServices>
): Promise<Result.Result<A, E>> {
  return runRequestEffect(c, provideDomain(c, Effect.result(program)))
}

/**
 * Run an Effect program and return a Hono JSON response.
 *
 * Runs the program, renders a failure through the sanitized error envelope, and
 * validates a success against the response schema when one is given. The
 * failure channel is {@link RouteFailure}: a program keeps its tagged errors
 * as they are, and `sanitizeError` decides the status from the `_tag` at run
 * time. There is no other path from a failure to a response.
 *
 * @param c - Hono context for response generation
 * @param program - Effect program to execute
 * @param schema - Effect Schema the success value is validated against
 * @param successStatus - HTTP status code for successful response (default: 200)
 * @returns JSON response with validated data or error
 *
 * @example
 * ```typescript
 * app.get('/api/users', async (c) =>
 *   runEffect(c, listUsersProgram(), listUsersResponseSchema)
 * )
 * app.post('/api/users', async (c) =>
 *   runEffect(c, createUserProgram(), createUserResponseSchema, 201)
 * )
 * ```
 */
export async function runEffect<T, S extends Schema.Top = Schema.Top>(
  c: Context,
  program: Effect.Effect<T, RouteFailure>,
  schema?: S,
  successStatus: number = 200
) {
  try {
    // `respondWith` matches the failure into a response, so the typed error
    // reaches `sanitizeError` as ITSELF: the tag-to-status mapping depends on it.
    // (Effect 4's runner squashes the cause to the original error on a throw
    // too — see `infrastructure/database/transaction.ts` — but matching keeps
    // a failure off the exception path altogether.)
    //
    // Run through `runRequestEffect` so the program executes on the observability
    // runtime under the request-edge root `http.server` span: any `Effect.withSpan`
    // seams inside (e.g. the DB access-layer `db.query` span) chain under the
    // request root.
    return await runRequestEffect(c, respondWith(c, program, schema, successStatus))
  } catch (error) {
    // Catches defects (Effect.die) and other unexpected runtime errors.
    return toErrorResponse(c, error)
  }
}
