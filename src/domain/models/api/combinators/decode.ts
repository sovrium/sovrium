/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'

/**
 * Decoding bridge for the API models during the Zod -> Effect Schema migration.
 *
 * The 90 schema files under `src/domain/models/api/` are read by ~100 consumer
 * files that call `.parse()` / `.safeParse()` on them. Migrating a schema and
 * every one of its consumers in one commit would make each batch unreviewable,
 * so these two functions let a schema change library while its call sites change
 * only their SPELLING — `X.parse(v)` becomes `decodeOrThrow(X)(v)`, with the
 * same success value and the same throw-on-invalid behaviour.
 *
 * They are deliberately thin. `decodeOrThrow` is `Schema.decodeUnknownSync`
 * under a name that says what it does at a call site, and {@link decodeSafe}
 * returns a discriminated result rather than Effect's `Result`, because that is
 * what the existing call sites branch on.
 */

/**
 * Decode options derived from the schema's own annotations.
 *
 * Zod carried strictness ON THE SCHEMA (`.strict()`); Effect takes it as a
 * decode-time option. Reading it back off a `strictKeys` annotation keeps it
 * where it was, which matters for the generic gates: a helper that receives a
 * schema as a parameter and validates a response through it cannot know whether
 * that schema was meant to reject unknown keys, so passing the flag at each call
 * site would silently loosen exactly those boundaries — including the invitation
 * response gate, whose stated job is to catch a smuggled token.
 */
const optionsFor = (schema: Schema.Top): { readonly onExcessProperty?: 'error' } => {
  const annotations = (schema as unknown as { ast?: { annotations?: Record<string, unknown> } }).ast
    ?.annotations
  return annotations?.['strictKeys'] === true ? { onExcessProperty: 'error' } : {}
}

/**
 * Decode, throwing on failure. The direct replacement for Zod's `.parse()`.
 *
 * Curried so a call site changes shape once (`X.parse(v)` -> `decodeOrThrow(X)(v)`)
 * rather than being restructured.
 */
export const decodeOrThrow =
  <S extends Schema.Top>(schema: S) =>
  (value: unknown): S['Type'] =>
    // `Schema.Top` rather than `Codec<A, I, never, never>`: the tighter bound
    // reads better but does not survive a long `.annotate(...).pipe(check)`
    // chain, where the compiler widens the schema's service parameters and then
    // rejects schemas that decode perfectly well. The cast is confined here, and
    // the models it serves describe a WIRE FORMAT — synchronous and
    // dependency-free by construction, so a service-requiring schema could not
    // reach this function without also failing loudly on the first request.
    Schema.decodeUnknownSync(schema as never, optionsFor(schema))(value) as S['Type']

/** The outcome of a non-throwing decode — Zod's `.safeParse()` return shape. */
export type SafeDecodeResult<A> =
  | { readonly success: true; readonly data: A }
  | { readonly success: false; readonly error: Schema.SchemaError }

/**
 * Decode without throwing. The direct replacement for Zod's `.safeParse()`.
 *
 * Returns `{ success, data | error }` rather than Effect's `Result` on purpose:
 * every existing call site branches on `.success`, and changing the branch shape
 * as well as the call shape would turn a mechanical rename into a rewrite of
 * ~200 conditionals. `error` is Effect's `SchemaError`, whose `message` already
 * renders the failing path — richer than the `ZodError` it replaces.
 */
export const decodeSafe =
  <S extends Schema.Top>(schema: S) =>
  (value: unknown): SafeDecodeResult<S['Type']> => {
    // Same widening reason as `decodeOrThrow` above.
    const result = Schema.decodeUnknownResult(schema as never, optionsFor(schema))(value)
    return Result.isSuccess(result)
      ? { success: true, data: result.success as S['Type'] }
      : { success: false, error: result.failure }
  }
