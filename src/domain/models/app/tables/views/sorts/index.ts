/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ViewSortSchema = Schema.Struct({
  field: Schema.String,
  direction: Schema.Literal('asc', 'desc'),
}).pipe(
  Schema.annotations({
    title: 'View Sort',
    description: 'Sort configuration for a single field.',
  })
)

export type ViewSort = Schema.Schema.Type<typeof ViewSortSchema>
