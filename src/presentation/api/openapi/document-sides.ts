/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which SIDE of a codec the document describes.
 *
 * An Effect `Codec<A, I>` has two shapes — the decoded `A` a handler sees and
 * the encoded `I` that travels on the wire — and they are not always the same.
 * A request body is documented on its INPUT side and a response on its OUTPUT
 * side; where a schema is annotated for both, the two are merged rather than
 * one being picked.
 */

import { Schema } from 'effect'
import { findInputMarker } from './markers'
import { REF_SIBLING_METADATA } from './normalize'
import type { JsonSchema } from './markers'

/**
 * Adapter: Effect Schema -> OpenAPI 3.1 document fragments.
 *
 * `@hono/zod-openapi` is built on `@asteasolutions/zod-to-openapi`, which walks
 * Zod internals. Measured behaviour of that library against a PLAIN JSON-Schema
 * object (probes run 2026-09-03 against `@hono/zod-openapi@1.5.1`):
 *
 * | position                | plain JSON Schema accepted? |
 * |-------------------------|-----------------------------|
 * | `responses[*].content`  | YES — emitted verbatim      |
 * | `request.body.content`  | YES — emitted verbatim      |
 * | `request.query`         | NO  — `schema._zod.parent`  |
 * | `request.params`        | NO  — `schema._zod.parent`  |
 * | top-level `parameters`  | YES — emitted verbatim      |
 *
 * So responses and bodies take {@link effectJsonResponse} / {@link effectJsonBody}
 * directly, while query and path parameters go through {@link effectParameters},
 * which does by hand the one thing zod-to-openapi needs Zod internals for:
 * turning an object schema into the flat `parameters[]` array (a
 * `name`/`in`/`required` triple per property). That is the whole reason a raw
 * JSON Schema is rejected there — a JSON Schema cannot say which of `query`,
 * `path`, or `header` it describes.
 *
 * ── NAMED COMPONENTS ──
 *
 * An Effect schema carrying an `identifier` annotation is HOISTED into
 * `components/schemas` and referenced by `$ref`, which is exactly what Zod's
 * `.openapi('Name')` does today. A schema without one is inlined, matching a
 * bare `z.object()`. So the choice of hoist-vs-inline stays where it already
 * lives — on the schema — and migrating a `.openapi('X')` schema means adding
 * `identifier: 'X'`.
 *
 * Components travel from the helper that built a fragment up to the document
 * builder on a SYMBOL property ({@link COMPONENTS}), read by
 * `collectRouteComponents`. A symbol is invisible to `JSON.stringify`, to
 * `Object.entries`, and to zod-to-openapi's own walks, so a fragment carrying
 * one still serialises as a plain OpenAPI object — while nothing has to be
 * declared twice. A separate `components:` field on each route group was the
 * alternative and was rejected: it can drift out of sync with the routes that
 * actually reference the names, which reintroduces the dangling `$ref` this
 * design exists to prevent.
 *
 * ── Three emission differences vs Zod, all deliberate and all measured ──
 *
 * 1. `additionalProperties: false` — Effect always emits it for a Struct;
 *    zod-to-openapi omits it for a non-strict `z.object()`. It is stripped
 *    everywhere, because it is not merely cosmetic but FALSE — neither
 *    library rejects an unknown key. See {@link stripAdditionalProperties}.
 * 2. Refinements land in `allOf` — `Schema.check(isMinLength(1))` emits
 *    `{ type: 'string', allOf: [{ minLength: 1 }] }` where Zod emits a flat
 *    `{ type: 'string', minLength: 1 }`. Semantically identical to every
 *    validator; visually different in Scalar. {@link flattenAllOf} folds the
 *    single-branch case back down so the served document keeps Zod's shape.
 * 3. Annotation order is load-bearing — `.annotate(...)` AFTER `.pipe(check)`
 *    attaches the description to the CHECK, so it lands inside `allOf` instead
 *    of on the node. Always annotate BEFORE checking.
 */

/**
 * The DECODED side of a schema, which is the side an API document describes.
 *
 * `toJsonSchemaDocument` emits the ENCODED side. For a wire-format DTO the two
 * coincide, so this is a no-op almost everywhere — but not for a coerced query
 * parameter. `?page=2` arrives as a string and means an integer; Zod documented
 * the integer, and emitting the encoded side would publish `type: "string"`
 * with the numeric bounds silently gone, since those constrain the decoded
 * value.
 *
 * Applying it uniformly rather than only at the coerced sites is deliberate:
 * the decoded side is what a caller of this API deals with, and the zero-diff
 * check over both documents is what proves the two coincide everywhere else.
 */
const decodedSide = (schema: Schema.Top): never => Schema.toType(schema as never) as never

/**
 * Render a schema, taking each node from the side it asks to be documented.
 *
 * The decoded side is the default and the right answer almost everywhere: a
 * coerced `?page=2` is a string on the wire and an integer to the API, and the
 * numeric bounds live on the decoded value. A `.transform()` wants the other
 * side — `z.union([string, number]).transform(String)` accepts either, and a
 * caller needs to know what is ACCEPTED. Both trees have the same structure, so
 * a parallel walk can take each node from whichever side it marked itself with.
 */
export const documentedSides = (
  schema: Schema.Top
): { schema: JsonSchema; definitions: JsonSchema } => {
  const decoded = Schema.toJsonSchemaDocument(decodedSide(schema))
  const encoded = Schema.toJsonSchemaDocument(schema as never)
  return {
    schema: mergeSides(decoded.schema as JsonSchema, encoded.schema as JsonSchema) as JsonSchema,
    definitions: mergeSides(
      decoded.definitions as JsonSchema,
      encoded.definitions as JsonSchema
    ) as JsonSchema,
  }
}

/** Take marked nodes from `encoded`, everything else from `decoded`. */
const mergeSides = (decoded: unknown, encoded: unknown): unknown => {
  if (Array.isArray(decoded)) {
    return decoded.map((item, index) =>
      mergeSides(item, Array.isArray(encoded) ? encoded[index] : undefined)
    )
  }
  if (typeof decoded !== 'object' || decoded === null) return decoded
  const node = decoded as JsonSchema
  if (findInputMarker(node) && typeof encoded === 'object' && encoded !== null) {
    // STRUCTURE comes from the encoded side; METADATA does not. Effect drops
    // annotations when it renders the input shape of a transformation, so
    // taking the encoded node wholesale silently deletes the field's
    // description from the published document — invisible in a decode test,
    // and a documentation regression on every transformed field.
    const described = Object.fromEntries(
      Object.entries(node).filter(
        ([key, value]) =>
          REF_SIBLING_METADATA.has(key) &&
          (encoded as JsonSchema)[key] === undefined &&
          // Never carry a sentinel across. `title` is how this module signals to
          // itself (`sovrium:document-input`, `sovrium:strict-keys`,
          // `sovrium:extends=`); copying one onto the surviving node publishes an
          // internal marker in the API contract.
          !(typeof value === 'string' && value.startsWith('sovrium:'))
      )
    )
    return { ...(encoded as JsonSchema), ...described }
  }
  const counterpart = (typeof encoded === 'object' && encoded !== null ? encoded : {}) as JsonSchema
  return Object.fromEntries(
    Object.entries(node).map(([key, child]) => {
      // `required` is a statement about the WIRE, so it always comes from the
      // encoded side. A field carrying a default is optional in the request a
      // client sends and present in the value the handler receives; reading it
      // off the decoded side publishes every defaulted field as mandatory.
      // `effectParameters` makes the same correction for query parameters.
      if (key === 'required' && Array.isArray(counterpart[key])) return [key, counterpart[key]]
      return [key, mergeSides(child, counterpart[key])]
    })
  )
}
