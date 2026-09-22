/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'
import { validator } from 'hono/validator'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { ValidationTargets } from 'hono'

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
) =>
  validator(target, (value, c) => {
    const decoded = Schema.decodeUnknownResult(schema)(value)
    if (Result.isSuccess(decoded)) {
      return decoded.success
    }
    return c.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: ApiErrorCode.VALIDATION_ERROR,
        errors: toFieldErrors(decoded.failure, target),
      },
      400
    )
  })
