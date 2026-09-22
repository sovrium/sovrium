/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Sentinel `title` marking a field that accepts an EXPLICIT `undefined`.
 *
 * Read back by `stripOptionalUndefined` in
 * `src/presentation/api/openapi/markers.ts`,
 * which drops the `undefined` branch this helper adds before the document
 * ships. It rides on `title` for the same reason the `sovrium:strict-keys`
 * marker next to it does: Effect drops every CUSTOM annotation on the way to
 * JSON Schema, and `title` is the only carrier that survives. The
 * `sovrium:` prefix puts it under the blanket assertion in
 * `openapi-schema.test.ts` that no internal marker ever reaches the document.
 */
export const OPTIONAL_UNDEFINED_MARKER = 'sovrium:optional-undefined'

/**
 * Zod's `.optional()`, spelled for Effect 4.
 *
 * WHY THIS FILE EXISTS
 *
 * `z.string().optional()` accepts THREE inputs: the key absent, the key present
 * holding `undefined`, and the key present holding a string. Effect 4 splits
 * that into two combinators and the migration reached for the wrong half:
 *
 * | spelling                     | absent | present `undefined` | present value |
 * | ---------------------------- | ------ | ------------------- | ------------- |
 * | `z.string().optional()`       | OK     | OK                  | OK            |
 * | `Schema.optionalKey(String)`  | OK     | **REJECTED**        | OK            |
 * | `Schema.optional(String)`     | OK     | OK                  | OK            |
 *
 * `optionalKey` is EXACT-optional: it makes the key omittable and nothing more,
 * so a present key holding `undefined` fails with `Expected string at ["x"]`.
 * That is a narrowing of the published contract, and it is not theoretical in
 * this codebase for two structural reasons:
 *
 *   - **Requests.** Query and body inputs are assembled as explicit allow-list
 *     objects with EVERY key present, because Hono silently drops an undeclared
 *     query param (the rationale is written out at
 *     `src/presentation/api/routes/admin/agents.ts`, above
 *     `parseConversationsQuery`). An unsupplied param therefore
 *     arrives as a present key holding `undefined`, not as an absent key —
 *     which `optionalKey` answers with a 400.
 *   - **Responses.** A database row carries a `NULL` column into the response
 *     encoder as `undefined`, so the ENCODE side fails the same way and the
 *     route answers 500. `GET /api/tables/{id}` did exactly that on
 *     `tableSchema.description`.
 *
 * `Schema.optional(S)` is defined upstream as `optionalKey(UndefinedOr(S))` and
 * restores all three cases, while still REJECTING a present key of the wrong
 * type — and still rejecting `null`, which is a different contract this helper
 * deliberately does not widen to.
 *
 * WHY IT IS A HELPER AND NOT A BARE `Schema.optional`
 *
 * The `UndefinedOr` half is invisible at runtime and LOUD in the published
 * document: `Schema.toJsonSchemaDocument` renders an `Undefined` member as
 * `{ "type": "null" }`, so a bare `Schema.optional(Schema.String)` emits
 * `anyOf: [{ type: 'string' }, { type: 'null' }]` where Zod emitted a bare
 * `{ type: 'string' }`. That is not cosmetic — it tells every generated client
 * and every Scalar reader that the field accepts `null`, which it does not.
 *
 * The branch cannot be suppressed at the source: measured on
 * effect 4.0.0-rc.108, an annotation on the `Schema.Undefined` member itself is
 * DROPPED by the emitter, so the member cannot be marked. The marker therefore
 * goes on the wrapper, where `title` does survive, and the adapter removes the
 * branch and the marker together. Routing every call site through one function
 * is what keeps that pairing from being forgotten one field at a time.
 *
 * @example
 * ```ts
 * import { optionalField } from './optional-field'
 *
 * const querySchema = Schema.Struct({
 *   cursor: optionalField(Schema.String),
 *   status: optionalField(Schema.Literals(['open', 'closed'])),
 * })
 * ```
 */
export const optionalField = <S extends Schema.Top & { readonly Rebuild: S }>(
  self: S
): Schema.optional<S> => Schema.optional(self).annotate({ title: OPTIONAL_UNDEFINED_MARKER })
