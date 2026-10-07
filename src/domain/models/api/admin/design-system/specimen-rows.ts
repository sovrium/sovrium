/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/design-system/specimen-rows` — the
 * catalogue's platform fixture rows.
 *
 * The body is `windowSpecimenRows(...)` serialised as is, so this schema is
 * DERIVED from the domain `SpecimenPage` type
 * (`domain/models/app/design/specimen-fixture.ts`) rather than restated: a row
 * is an open record of string, number or boolean values, and `total` is the
 * size of the CAPPED fixture, not the length of the page. The two compile-time
 * assertions in `specimen-rows.test.ts` fail the typecheck if the domain type
 * and this wire shape drift apart in either direction.
 *
 * The row is deliberately an OPEN record rather than a fixed struct. Its
 * columns are fixture content the platform owns and grows (append-only at the
 * head, pinned by the unit suite beside the fixture), and a closed struct here
 * would turn every new specimen column into a wire-contract change for a
 * payload that names no operator data at all.
 *
 * The query schema is the existing `specimenRowsQuerySchema` in
 * `design-system.ts` (`rows`, `page`, `limit`).
 */

import { Schema } from 'effect'

/** One fixture row: field name → string, finite number or boolean. */
const specimenRowSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
).annotate({
  identifier: 'SpecimenRow',
  description:
    'One platform fixture row. Keys include `id`, `name`, `role`, `status`, `priority`, `category`, `description`, `amount`, `share`, `views`, `size`, `recordNumber`, `active`, `startsAt`, `endsAt`, `scheduledAt` and `allDay`; values are real types, never strings that look like numbers.',
})

/**
 * Response schema for `GET /api/admin/design-system/specimen-rows`.
 */
export const specimenRowsResponseSchema = Schema.Struct({
  items: Schema.Array(specimenRowSchema).annotate({
    description: 'The page of the capped fixture this request asked for.',
  }),
  total: Schema.Int.annotate({
    description:
      'Size of the CAPPED fixture, not of this page, so a pager can say `1-10 of 30`. `0` under `?rows=0`.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SpecimenRowsResponse',
})

/** @public */
export type SpecimenRowsResponse = typeof specimenRowsResponseSchema.Type
