/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ComponentSearchSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({ description: 'Enable search bar (default: true)' })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Search input placeholder text',
      examples: ['Search products...', 'Type to search...'],
    })
  ),
  debounceMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description: 'Debounce delay for search input in ms (default: 300)',
        examples: [200, 300, 500],
      })
    )
  ),
  highlight: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Highlight matched search terms in results (default: false)',
    })
  ),
}).annotations({
  identifier: 'ComponentSearch',
  title: 'Component Search',
  description:
    'Shared search bar configuration for data-bound components (data-table, kanban, calendar)',
})

export type ComponentSearch = Schema.Schema.Type<typeof ComponentSearchSchema>
