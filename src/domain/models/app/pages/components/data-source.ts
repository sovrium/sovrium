/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const FilterOperatorSchema = Schema.Literal(
  'eq',
  'neq',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'in'
).annotations({
  title: 'Filter Operator',
  description:
    'Comparison operator for filtering records. "in" expects an array value (e.g. resolved $currentUser.assignments.<table>).',
})

export const CurrentUserPathSchema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('scalar'),
    name: Schema.Literal('id', 'email', 'role', 'isUnrestricted'),
  }),
  Schema.Struct({
    kind: Schema.Literal('assignment'),
    tableSlug: Schema.String.pipe(Schema.minLength(1)),
  }),
  Schema.Struct({
    kind: Schema.Literal('activeAssignment'),
  })
).annotations({
  identifier: 'CurrentUserPath',
  title: 'Current-User Path',
  description: 'Typed path into the request-time-resolved session user',
})

export type CurrentUserPath = Schema.Schema.Type<typeof CurrentUserPathSchema>

export const CurrentUserRefSchema = Schema.Struct({
  kind: Schema.Literal('currentUser'),
  path: CurrentUserPathSchema,
}).annotations({
  identifier: 'CurrentUserRef',
  title: 'Current-User Reference',
  description:
    'Server-resolved reference to the authenticated user. Resolved per-request, never cached across users.',
})

export type CurrentUserRef = Schema.Schema.Type<typeof CurrentUserRefSchema>

export const FilterLiteralSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Number)
)

export const FilterValueSchema = Schema.Union(FilterLiteralSchema, CurrentUserRefSchema)

export type FilterValue = Schema.Schema.Type<typeof FilterValueSchema>
export type FilterLiteral = Schema.Schema.Type<typeof FilterLiteralSchema>

export const DataFilterSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  operator: FilterOperatorSchema,
  value: FilterValueSchema.annotations({
    description:
      'Literal value, $currentUser reference, or template string. $currentUser refs resolve per-request from session.',
  }),
}).annotations({
  title: 'Data Filter',
  description: 'Single filter condition for data source queries',
})

export const SortDirectionSchema = Schema.Literal('asc', 'desc').annotations({
  title: 'Sort Direction',
  description: 'Sort order: ascending or descending',
})

export const DataSortSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Field name to sort by',
  }),
  direction: SortDirectionSchema,
}).annotations({
  title: 'Data Sort',
  description: 'Single sort rule for data source queries',
})

export const PaginationStyleSchema = Schema.Literal('numbered', 'loadMore', 'infinite').annotations(
  {
    title: 'Pagination Style',
    description: 'How pagination controls are displayed',
  }
)

export const PaginationSchema = Schema.Struct({
  pageSize: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
    Schema.annotations({
      description: 'Number of records per page',
      examples: [10, 20, 50],
    })
  ),
  style: Schema.optional(PaginationStyleSchema),
}).annotations({
  title: 'Pagination',
  description: 'Pagination configuration for data source',
})

export const SearchEngineSchema = Schema.Literal('client', 'fts', 'trigram', 'hybrid').annotations({
  identifier: 'SearchEngine',
  title: 'Search Engine',
  description:
    "Search backend: 'client' (browser JS), 'fts' (PostgreSQL FTS), 'trigram' (pg_trgm fuzzy), 'hybrid' (FTS + trigram)",
})

export const DataSourceModeSchema = Schema.Literal('list', 'single', 'search').annotations({
  title: 'Data Source Mode',
  description:
    "Data fetching mode: 'list' (multiple), 'single' (one record), 'search' (interactive)",
})

export const DataSourceSchema = Schema.Struct({
  table: Schema.String.annotations({
    description: 'Table name to bind to (validated against app.tables)',
  }),
  fields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Specific fields to fetch from the table',
        examples: [['title', 'author', 'createdAt']],
      })
    )
  ),
  mode: Schema.optional(DataSourceModeSchema),
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotations({
      description: 'Filter conditions applied with AND logic',
    })
  ),
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotations({
      description: 'Sort rules applied in order',
    })
  ),
  pagination: Schema.optional(PaginationSchema),
  param: Schema.optional(
    Schema.String.annotations({
      description: 'Route parameter name for single mode (e.g., slug, id)',
      examples: ['slug', 'id'],
    })
  ),
  searchEngine: Schema.optional(
    SearchEngineSchema.annotations({
      description:
        "Search backend for this data source (default: 'client'). Same table can use different engines on different pages.",
    })
  ),
  searchFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Fields to search across in search mode',
        examples: [['name', 'description']],
      })
    )
  ),
  debounceMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description: 'Debounce delay for search input (ms)',
        examples: [300, 500],
      })
    )
  ),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of results to return',
        examples: [10, 20, 50],
      })
    )
  ),
  targetId: Schema.optional(
    Schema.String.annotations({
      description: 'Identifier for cross-component data source references',
    })
  ),
  bindTo: Schema.optional(
    Schema.String.annotations({
      description:
        'ID of a searchInput component whose query drives this data source (cross-component binding)',
    })
  ),
}).annotations({
  identifier: 'DataSource',
  title: 'Data Source',
  description:
    'Binds a component to table data. Supports list, single-record, and search modes with filtering, sorting, and pagination.',
})

export type DataSource = Schema.Schema.Type<typeof DataSourceSchema>
export type DataFilter = Schema.Schema.Type<typeof DataFilterSchema>
export type DataSort = Schema.Schema.Type<typeof DataSortSchema>
export type Pagination = Schema.Schema.Type<typeof PaginationSchema>
export type FilterOperator = Schema.Schema.Type<typeof FilterOperatorSchema>
export type SortDirection = Schema.Schema.Type<typeof SortDirectionSchema>
export type PaginationStyle = Schema.Schema.Type<typeof PaginationStyleSchema>
export type DataSourceMode = Schema.Schema.Type<typeof DataSourceModeSchema>
export type SearchEngine = Schema.Schema.Type<typeof SearchEngineSchema>
