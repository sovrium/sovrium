/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * Query-string coercion, matching what `z.coerce.*` did.
 *
 * URL query parameters arrive as strings, so `?page=2` has to become the number
 * `2` before any numeric bound can be checked. Zod spelled that `z.coerce`;
 * Effect has no coercing constructor, and its `FiniteFromString` is narrower —
 * it accepts ONLY a string, where `z.coerce.number()` also accepted a number
 * that had already been parsed. Decoding from `Schema.Unknown` reproduces the
 * wider domain.
 *
 * The emitted document is unaffected by that width: the OpenAPI adapter renders
 * the DECODED side, so a coerced parameter still publishes as `integer` with
 * its bounds, exactly as before.
 */

/**
 * `z.coerce.number()` — `Number(input)`, rejecting a result that is not finite.
 *
 * `Number('x')` is `NaN` and `Schema.Finite` rejects it, which is how a
 * non-numeric query value fails rather than silently becoming `NaN`.
 */
export const coercedNumber = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Finite, {
    decode: SchemaGetter.transform((value: unknown) => Number(value)),
    encode: SchemaGetter.transform((value) => value as unknown),
  })
)

/**
 * `z.coerce.boolean()` — `Boolean(input)`, footgun included.
 *
 * ⚠️ ANY non-empty string is `true`, so `?include_deleted=false` coerces to
 * TRUE. That is not an oversight being carried forward blindly: it is the
 * behaviour the API has shipped, it is documented at the call site in
 * `admin/buckets/list.ts`, and changing it here would silently alter what a
 * live query returns while every schema test still passed. Tightening it is a
 * behaviour change that belongs in a spec, not in a library migration.
 */
export const coercedBoolean = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value: unknown) => Boolean(value)),
    encode: SchemaGetter.transform((value) => value as unknown),
  })
)

/**
 * A boolean query flag that accepts `true`/`false` or the strings `"true"`/`"1"`.
 *
 * Deliberately NOT `coercedBoolean`: this parse is STRICT, so
 * `?include_deleted=false` is FALSE. The two coexist because the API has both —
 * `z.coerce.boolean()` at some endpoints, this hand-written union at others —
 * and collapsing them would silently change what one set of queries returns.
 * Which endpoint should use which is a spec question, not a migration one.
 */
export const booleanFlag = Schema.Union([Schema.Boolean, Schema.String]).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value: boolean | string) =>
      typeof value === 'boolean' ? value : value === 'true' || value === '1'
    ),
    encode: SchemaGetter.transform((value) => value as boolean | string),
  })
)
