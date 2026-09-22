/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { OPTIONAL_UNDEFINED_MARKER } from '@/domain/models/api/combinators/optional-field'

/**
 * The ONE sanctioned place in `src/domain/models/api/` that may name `Effect`.
 *
 * WHY THIS FILE EXISTS
 *
 * Zod spells a wire-format default `z.string().default('anon')`. Effect 4 has
 * no value-taking equivalent: all four variants — `withDecodingDefaultKey`,
 * `withDecodingDefault`, `withDecodingDefaultTypeKey`, `withDecodingDefaultType`
 * — declare `defaultValue: Effect.Effect<…>` and take nothing else. A plain
 * value and a thunk both fail at runtime with "Sync adapter can only throw
 * schema errors". So a wire-format schema cannot express a default without
 * naming `Effect`, and `[internal ref]` Block B bans exactly
 * that name in this directory.
 *
 * The ban is right and stays. Its intent is that wire-format files carry no
 * Effect PROGRAMS — no DI, no Layers, no effectful flows. `Effect.succeed(x)`
 * around a literal is not a program; it is v4's spelling of a value. Rather
 * than relax the ban across every file that carries a default so each can
 * restate that spelling, the import is confined here and every caller writes
 * `withDefault(x)`, which reads as what it is. `[internal ref]` Block B2 sanctions this single
 * path; `Context`, `Layer`, `pipe` and `flow` stay banned even here.
 *
 * WHY IT IS A FUNCTION AND NOT A DOC NOTE
 *
 * The ordering below is load-bearing and its failure mode is SILENT. Measured
 * against `Schema.toJsonSchemaDocument` on effect 4.0.0-rc.108:
 *
 * | pipe order                                   | JSON Schema `default` |
 * | -------------------------------------------- | --------------------- |
 * | `withDecodingDefaultKey` alone               | ABSENT                |
 * | `withDecodingDefaultKey` then `annotate`     | ABSENT (dropped)      |
 * | `annotate` then `withDecodingDefaultKey`     | present               |
 *
 * All three DECODE identically, so a unit test on decoding cannot tell them
 * apart — only the emitted document can. Zod's `.default(x)` puts `"default": x`
 * in the OpenAPI document, so the two wrong orders silently drop a key from the
 * published API contract while every test stays green. Encoding the correct
 * order in one function makes that unrepresentable at the call sites.
 *
 * TWO RESIDUAL CAVEATS, both properties of the schema node and NOT of this
 * helper (measured the same way):
 *
 *   - `Schema.Number` renders as an `anyOf` (number | "Infinity" | "-Infinity"
 *     | "NaN") and drops annotations entirely, so no `default` is emitted for
 *     it by any spelling. `Schema.Finite` / `Schema.Int` do carry it.
 *   - a REFINED node (`Schema.Finite`, `Schema.Int`, anything with a `check`)
 *     nests the default as `allOf: [{ default: x }]` rather than putting it on
 *     the node, because the refinement already sits between. Same cause as the
 *     `annotate`-before-`check` rule in
 * `[internal ref]`.
 *
 * WHY `withDecodingDefault` AND NOT `withDecodingDefaultKey`
 *
 * `z.string().default('x')` substitutes the default for BOTH an absent key and
 * a present key holding `undefined`. Effect 4 splits those, exactly as it
 * splits `.optional()`:
 *
 * | spelling                   | absent   | present `undefined` |
 * | -------------------------- | -------- | ------------------- |
 * | `z.string().default('x')`   | default  | default             |
 * | `withDecodingDefaultKey`    | default  | **REJECTED**        |
 * | `withDecodingDefault`       | default  | default             |
 *
 * The `Key` variant was the wrong half for the same structural reason
 * `Schema.optionalKey` was: a route builds its query object as an explicit
 * allow-list with every key present, so an unsupplied `?order=` arrives as a
 * present `undefined` and answered 400. Nineteen admin endpoints did.
 *
 * `withDecodingDefault` wraps the ENCODED side in `Schema.optional`, so it
 * inherits the document problem too — the `Undefined` member renders as
 * `{ "type": "null" }`. It is marked with the same
 * {@link OPTIONAL_UNDEFINED_MARKER} the adapter already strips, with one
 * difference forced by the emitter: the marker goes on the INNER node, before
 * the combinator, because an annotation applied to the resulting `decodeTo`
 * node does not reach JSON Schema at all. It therefore surfaces INSIDE the
 * first `anyOf` member rather than on the wrapper, and
 * `stripOptionalUndefined` reads both positions.
 *
 * @example
 * ```ts
 * import { withDefault } from './schema-defaults'
 *
 * const querySchema = Schema.Struct({
 *   limit: Schema.Int.pipe(withDefault(20)),
 *   order: Schema.Literals(['asc', 'desc']).pipe(withDefault('asc')),
 * })
 * ```
 *
 * @param value - the default value. Typed `S['Type'] & S['Encoded']` because
 *   the two combinators this composes disagree on domain: `annotate` types
 *   `default` against `S['Type']` (`Annotations.Documentation<T>`) while
 *   `withDecodingDefaultKey` takes `Effect<S['Encoded']>`. Requiring both is
 *   right for wire-format DTOs, where the two coincide by construction — these
 *   files describe JSON going over the wire, so a schema whose decoded shape
 *   differs from its encoded shape does not belong in this directory. A true
 *   codec needs `withDecodingDefaultTypeKey` (Type domain) or
 *   `annotateEncoded` (Encoded domain) chosen deliberately, which is a
 *   different helper and should be added here rather than at a call site, so
 *   the `Effect` import stays confined to this file.
 */
export const withDefault =
  <S extends Schema.Top & { readonly Rebuild: S }>(value: S['Type'] & S['Encoded']) =>
  (self: S): Schema.withDecodingDefault<S> =>
    self.pipe(
      // BEFORE the combinator. Reversing these two lines silently drops
      // `default` from the published OpenAPI document — see the table above.
      // The marker rides along in the SAME annotate for the reason spelled out
      // under WHY `withDecodingDefault` above: it is the only position from
      // which it survives into the document.
      Schema.annotate({ default: value, title: OPTIONAL_UNDEFINED_MARKER }),
      Schema.withDecodingDefault<S>(Effect.succeed(value))
    )
