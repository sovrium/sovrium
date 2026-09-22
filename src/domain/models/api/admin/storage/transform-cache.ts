/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Admin transform-cache clear response schema
 *
 * The body returned by `DELETE /api/admin/storage/transform-cache`, which
 * discards the derived image-transform variants without touching the stored
 * originals.
 *
 * The two counts report what THIS call dropped, so an immediate second clear
 * reports zero for both. They are the operator's only feedback: a cache hit and
 * a fresh transform are byte-identical on the download route, so nothing there
 * can witness whether the clear took effect.
 *
 * Deliberately carries no `identifier` annotation, so the shape is INLINED at
 * its single use site rather than hoisted into `components/schemas` — matching
 * its sibling `status.ts`. Hoisting only pays for a shape referenced more than
 * once.
 *
 * Both counts annotate BEFORE `.pipe(Schema.check(...))`: a trailing
 * `annotate` attaches to the last check rather than to the node, which drops
 * the description from the emitted document.
 */
export const clearTransformCacheResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Transform cache cleared successfully' }),
  message: Schema.String.annotate({ description: 'Human-readable confirmation message' }),
  clearedEntries: Schema.Int.annotate({
    description: 'Number of derived variants dropped by this call',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  clearedBytes: Schema.Int.annotate({
    description: 'Total bytes those derived variants occupied',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

/**
 * The handler's own type, exported for `handleDeleteTransformCache` to consume.
 *
 * This export was deliberately withheld while the handler still declared a local
 * `ClearedTransformCacheResponse` interface — Knip fails on an exported type
 * nothing imports, and the note here said to add it in the SAME change that adds
 * its importer. That change is this one: the local interface is gone and the
 * handler now decodes through `clearTransformCacheResponseSchema`, so the shape
 * is spelled ONCE and the runtime body is checked against the published contract
 * rather than merely resembling it. Matches its sibling `status.ts`.
 */
export type ClearTransformCacheResponse = typeof clearTransformCacheResponseSchema.Type
