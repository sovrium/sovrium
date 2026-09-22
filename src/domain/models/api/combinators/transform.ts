/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * Marker asking the OpenAPI adapter to document a node's INPUT shape.
 *
 * The adapter renders the DECODED side, because that is what a coerced query
 * parameter means: `?page=2` is a string on the wire and an integer to the API.
 * A `.transform()` wants the opposite. `z.union([string, number]).transform(String)`
 * accepts either and yields a string, and Zod documented the union — the caller
 * needs to know what is ACCEPTED, not what the server ends up holding.
 *
 * Both are right; they are just different questions, so the node says which one
 * it is answering. The marker rides on `title` for the same reason the others
 * do — Effect passes no custom annotation through to JSON Schema — and the
 * adapter removes it before the document is emitted.
 */
export const DOCUMENT_INPUT_MARKER = 'sovrium:document-input'

/**
 * Normalise an accepted value into a canonical one — Zod's `.transform()`.
 *
 * Encoding is the identity: these transformations run inbound only, widening
 * what a client may send, and the canonical value is already a legal input.
 *
 * @param source - what the API accepts
 * @param target - what the rest of the code receives
 * @param normalise - how the first becomes the second
 */
export const transformed = <From extends Schema.Top, To extends Schema.Top>(
  source: From,
  target: To,
  normalise: (value: From['Type']) => To['Type']
): Schema.Codec<To['Type'], From['Encoded'], never, never> =>
  source
    .pipe(
      Schema.decodeTo(target, {
        decode: SchemaGetter.transform(normalise as (value: unknown) => unknown),
        encode: SchemaGetter.transform((value) => value as unknown),
      })
    )
    .annotate({ title: DOCUMENT_INPUT_MARKER }) as never
