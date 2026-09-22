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
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { sanitizeError, getStatusCode } from './error-sanitizer'
import type { Schema } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Render ANY error as the canonical Sovrium error envelope, sanitized.
 *
 * This is the composable half of {@link runEffect}, and it exists because
 * `runEffect` cannot serve most of the route tree. `runEffect` owns the WHOLE
 * response — it runs the program, maps a failure, and shapes the success — so a
 * handler that branches on `_tag` and then *continues* with the success value
 * can never reach its error rendering. Measured 2026-09-11 that is the majority
 * of `_tag === 'Failure'` branches under `src/presentation/api/routes/`, and
 * every one of them had hand-rolled an envelope instead.
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
 * not be one: `user-views.ts` maps one and the same tag to 400 on create and 404
 * on update, and it is right to. The status answers "what did the CALLER get
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
 * Run an Effect program and return a Hono JSON response
 *
 * This utility handles:
 * - Running Effect programs as promises
 * - Validating responses against Zod schemas
 * - Converting errors to standardized error responses
 *
 * @param c - Hono context for response generation
 * @param program - Effect program to execute
 * @param schema - response schema the success value is validated against
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
  program: Effect.Effect<T, Error>,
  schema?: S,
  successStatus: number = 200
) {
  try {
    // Use Effect.either to preserve tagged error types (_tag property)
    // Effect.runPromise wraps errors in FiberFailure which strips _tag,
    // preventing error sanitizer from mapping to correct HTTP status codes.
    // Effect.either converts failures to Either.Left, preserving the original error.
    //
    // Run through `runRequestEffect` so the program executes on the observability
    // runtime under the request-edge root `http.server` span: any `Effect.withSpan`
    // seams inside (e.g. the DB access-layer `db.query` span) chain under the
    // request root. `Effect.either` already discharged failures to `Left`, so the
    // program has no requirements and needs no `provideLayer`.
    const either = await runRequestEffect(c, Effect.result(program))

    if (either._tag === 'Failure') {
      return toErrorResponse(c, either.failure)
    }

    if (!schema) return c.json(either.success, successStatus as ContentfulStatusCode)

    // `decodeSafe`, not `decodeOrThrow`. A response-schema mismatch is a broken
    // CONTRACT — this route computed a value its own published schema rejects —
    // and throwing turned that into an anonymous 500 from the `catch` below,
    // indistinguishable from a database outage and carrying no clue as to which
    // field was wrong. `SchemaError.message` renders the failing path, so the
    // branch below attributes it in the log and the operator gets the answer
    // from one line instead of from a bisect. The client still gets the
    // canonical 500 — a half-valid body must never reach the wire.
    const validated = decodeSafe(schema)(either.success)
    if (!validated.success) {
      const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
      // The path goes in the MESSAGE, not in the cause. `SchemaError.message`
      // renders it (`Expected number\n  at ["count"]`), but a `SchemaError`
      // carries no message on its stack header, so passing it as the cause logs
      // a bare `Error` and the attribution — the entire point of this branch —
      // is lost. Measured on effect@4.0.0-rc.108.
      logError(
        `[API Error] response failed its schema at ${c.req.method} ${c.req.path} requestId=${requestId}: ${validated.error.message}`,
        validated.error
      )
      return toErrorResponse(c, validated.error)
    }
    return c.json(validated.data, successStatus as ContentfulStatusCode)
  } catch (error) {
    // Catches defects (Effect.die) and other unexpected runtime errors. Schema
    // validation no longer arrives here — see the `decodeSafe` note above.
    return toErrorResponse(c, error)
  }
}
