/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * Reshape a request body BEFORE it is validated — Zod's `z.preprocess`.
 *
 * The API accepts more than one spelling of the same body: a record create takes
 * both the canonical `{ fields: { … } }` envelope and a flat `{ title: '…' }`,
 * and a normaliser lifts the second into the first before validation. Effect has
 * no `preprocess`, so the reshaping becomes the decode half of a transformation
 * from `Schema.Unknown` into the canonical schema.
 *
 * Two properties are load-bearing:
 *
 * - The DOCUMENT keeps describing the canonical shape, because the adapter
 *   renders the decoded side and this transformation decodes INTO `schema`. The
 *   alternative spellings are deliberately undocumented — they are a
 *   compatibility affordance, not part of the published contract, which is what
 *   Zod also published.
 * - The shape stays OPEN. These bodies carry an arbitrary field map, so nothing
 *   here may emit `additionalProperties: false`; the adapter strips it, and the
 *   canonical schema must not reintroduce it by being made strict.
 *
 * Encoding is the identity: the reshaping only ever runs inbound, and a body
 * that has already been normalised is its own encoded form.
 */
export const preprocessed = <S extends Schema.Top>(
  reshape: (input: unknown) => unknown,
  schema: S
): Schema.Codec<S['Type'], unknown, never, never> =>
  Schema.Unknown.pipe(
    Schema.decodeTo(schema, {
      decode: SchemaGetter.transform(reshape),
      encode: SchemaGetter.transform((value) => value as unknown),
    })
  ) as never
