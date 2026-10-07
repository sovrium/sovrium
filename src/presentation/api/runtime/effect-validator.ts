/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'
import { validator } from 'hono/validator'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { Context, Env, ValidationTargets } from 'hono'

/**
 * `zValidator`'s Effect-Schema twin, built on `hono/validator`.
 *
 * `hono/validator` takes any `(value, c) => decoded | Response` function, so
 * the schema library is not part of its contract — `@hono/zod-validator` is
 * itself only a thin wrapper around it. This is the whole runtime half of
 * dropping Zod: the OpenAPI half lives in `src/presentation/api/openapi/`,
 * across `schema-to-json.ts`, `route-fragments.ts` and `markers.ts`.
 *
 * ── ENVELOPE (deliberate change, see the report) ──
 *
 * On failure this emits the project's canonical error envelope,
 * `{ success, message, code, errors[] }` — the same one `validateRequest`
 * produces and `[internal ref]` pins for every 4xx.
 *
 * The `zValidator` calls this replaces passed NO hook, so they fell through to
 * `@hono/zod-validator`'s default, which answers `{ success: false, error:
 * <raw ZodError> }` — no `message`, no `code`, and a body shaped by Zod's
 * internals rather than by Sovrium's contract. Nothing asserted that shape, and
 * it is the one documented envelope those routes did not speak. Routes that DID
 * pass `validationErrorHook` already emitted the canonical envelope; this makes
 * the rest agree instead of preserving the divergence.
 */

/**
 * The context of a handler mounted behind `effectValidator(target, schema)`.
 *
 * `c.req.valid(target)` is typed from the third `Context` parameter: the fluent
 * chain fills it in, and a bare `Context` leaves it empty. A handler declared
 * apart from its chain names the decoded shape here and reads it with a plain
 * `c.req.valid(target)`. The chain's own context is assignable to this type,
 * and so is a bare `Context`, so the handler stays callable from a test.
 *
 * @example
 * ```typescript
 * const handleList = (c: ValidatedContext<'query', ListQuery>) => {
 *   const { limit } = c.req.valid('query')
 * }
 * app.get('/api/items', effectValidator('query', listQuerySchema), handleList)
 * ```
 */
export type ValidatedContext<Target extends keyof ValidationTargets, A> = Context<
  Env,
  string,
  { readonly out: { readonly [K in Target]: A } }
>

/** One field-level entry of the canonical validation envelope. */
type FieldError = {
  readonly field: string
  readonly message: string
}

/**
 * Flatten a `SchemaError` into field-level entries.
 *
 * A composite issue (`_tag: 'Composite'`) carries a nested `issues` array, one
 * per failing property; a leaf issue describes a single failure. Effect renders
 * both as `"<reason>\n  at [\"path\",\"to\",\"field\"]"`, so the path is parsed
 * back out of the rendered text rather than walked off the AST — the AST walk
 * needs a different branch per issue tag, and this envelope only needs a name
 * and a sentence. An unparseable path degrades to the target name, never to a
 * dropped error.
 */
const toFieldErrors = (
  error: Readonly<Schema.SchemaError>,
  target: string
): readonly FieldError[] =>
  error.message
    .split(/\n(?=[^\s])/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const pathMatch = /\bat \[(.+?)\]/s.exec(block)
      const field =
        pathMatch === null
          ? target
          : (pathMatch[1] ?? '')
              .split(',')
              .map((segment) => segment.trim().replace(/^["']|["']$/g, ''))
              .filter((segment) => segment.length > 0)
              .join('.')
      return {
        field: field.length > 0 ? field : target,
        message: block
          .replace(/\s*\bat \[.+?\]/s, '')
          .replace(/^SchemaError\(|\)$/g, '')
          .trim(),
      }
    })

/**
 * Decode a value against an Effect Schema, or answer the canonical 400.
 *
 * The decoding half of {@link effectValidator}, for a handler that must run its
 * own gates BEFORE the body is judged — a comment thread's sign-in and
 * spam-trap gates answer first, so a malformed body cannot tell a prober which
 * gate it reached. Same envelope as the route validator, so a client sees one
 * shape whichever of the two refused.
 */
export const decodeOrValidationResponse = <A, I>(
  c: Context,
  schema: Schema.Codec<A, I, never, never>,
  value: unknown,
  target: string
): A | Response => {
  const decoded = Schema.decodeUnknownResult(schema)(value)
  if (Result.isSuccess(decoded)) return decoded.success
  return c.json(validationFailureBody(decoded.failure, target), 400)
}

/**
 * The 400 body a request schema's refusal answers: one entry per failing
 * field. Shared with the admin read registry's HTTP adapter, whose reads decode
 * their query through the same schemas this validator once applied.
 */
export const validationFailureBody = (error: Readonly<Schema.SchemaError>, target: string) => ({
  success: false as const,
  message: 'Validation failed',
  code: ApiErrorCode.VALIDATION_ERROR,
  errors: toFieldErrors(error, target),
})

/**
 * Validate one request target against an Effect Schema.
 *
 * @param target - Hono validation target (`json`, `query`, `param`, …)
 * @param schema - Effect Schema describing the decoded shape
 *
 * @example
 * ```typescript
 * app.get('/api/records', effectValidator('query', listRecordsQuerySchema), (c) => {
 *   const query = c.req.valid('query') // typed from the schema
 * })
 * ```
 */
export const effectValidator = <Target extends keyof ValidationTargets, A, I>(
  target: Target,
  // `Codec<A, I, never, never>`, not `Schema.Top`: decoding here is
  // synchronous and dependency-free, and those two `never`s are what say so.
  // A schema needing a service or an async step cannot be decoded inside a
  // Hono validator, so it is rejected at the type level rather than at runtime.
  schema: Schema.Codec<A, I, never, never>
) => validator(target, (value, c) => decodeOrValidationResponse(c, schema, value, target))
