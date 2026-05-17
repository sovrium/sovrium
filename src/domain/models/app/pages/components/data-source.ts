/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Filter operator for data source queries
 */
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

/**
 * `$currentUser` path schema — typed paths into the resolved session-user
 * context.
 *
 * - `scalar` — `$currentUser.id`, `.email`, `.role`, `.isUnrestricted`
 * - `assignment` — `$currentUser.assignments.<tableSlug>` returns UUID[]
 *   from `user_access` rows for that scope
 * - `activeAssignment` — `$currentUser.activeAssignment` returns the
 *   `{ tableSlug, recordId }` object selected by the tenant switcher (P-6),
 *   or `null` when the user has only one assignment in any scope
 *
 * The `tableSlug` segment of an `assignment` path is validated against
 * `auth.scopeTables` at startup.
 */
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

/**
 * `$currentUser` reference — discriminated value used in
 * `dataSource.filter[].value`.
 */
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

/**
 * Literal filter value — JSON-serializable scalar or array of scalars.
 *
 * Arrays are accepted to support the `in` operator (e.g. when comparing a
 * field against the resolved record-id list from
 * `$currentUser.assignments.<table>`).
 */
export const FilterLiteralSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Number)
)

/**
 * Filter value — either a literal or a `$currentUser` reference.
 *
 * String-template sugar (resolved by the config loader before reaching this
 * schema):
 * - `'$currentUser.id'` -> `{ kind: 'currentUser', path: { kind: 'scalar', name: 'id' } }`
 * - `'$currentUser.assignments.<table>'` -> `{ kind: 'currentUser', path: { kind: 'assignment', tableSlug: '<table>' } }`
 * - `'$currentUser.activeAssignment'` -> `{ kind: 'currentUser', path: { kind: 'activeAssignment' } }`
 */
export const FilterValueSchema = Schema.Union(FilterLiteralSchema, CurrentUserRefSchema)

/** @public */
export type FilterValue = Schema.Schema.Type<typeof FilterValueSchema>
/** @public */
export type FilterLiteral = Schema.Schema.Type<typeof FilterLiteralSchema>

/**
 * Single filter condition
 *
 * @example
 * ```yaml
 * filter:
 *   - field: status
 *     operator: eq
 *     value: published
 *   - field: views
 *     operator: gte
 *     value: 100
 * ```
 */
export const DataFilterSchema = Schema.Struct({
  /** Field name to filter on */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Comparison operator */
  operator: FilterOperatorSchema,
  /**
   * Value to compare against.
   *
   * - **Literal**: string / number / boolean / string-array / number-array
   * - **`$currentUser` reference**: `{ kind: 'currentUser', path: ... }`
   *   resolved at request time from the authenticated session
   * - **String-template sugar** (resolved before this schema by the config
   *   loader): `'$currentUser.id'`, `'$currentUser.assignments.<table>'`,
   *   `'$currentUser.activeAssignment'`
   */
  value: FilterValueSchema.annotations({
    description:
      'Literal value, $currentUser reference, or template string. $currentUser refs resolve per-request from session.',
  }),
}).annotations({
  title: 'Data Filter',
  description: 'Single filter condition for data source queries',
})

/**
 * Sort direction for data source queries
 */
export const SortDirectionSchema = Schema.Literal('asc', 'desc').annotations({
  title: 'Sort Direction',
  description: 'Sort order: ascending or descending',
})

/**
 * Single sort rule
 *
 * @example
 * ```yaml
 * sort:
 *   - field: createdAt
 *     direction: desc
 * ```
 */
export const DataSortSchema = Schema.Struct({
  /** Field name to sort by */
  field: Schema.String.annotations({
    description: 'Field name to sort by',
  }),
  /** Sort direction */
  direction: SortDirectionSchema,
}).annotations({
  title: 'Data Sort',
  description: 'Single sort rule for data source queries',
})

/**
 * Pagination style
 */
export const PaginationStyleSchema = Schema.Literal('numbered', 'loadMore', 'infinite').annotations(
  {
    title: 'Pagination Style',
    description: 'How pagination controls are displayed',
  }
)

/**
 * Pagination configuration
 *
 * @example
 * ```yaml
 * pagination:
 *   pageSize: 20
 *   style: numbered
 * ```
 */
export const PaginationSchema = Schema.Struct({
  /** Number of records per page */
  pageSize: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
    Schema.annotations({
      description: 'Number of records per page',
      examples: [10, 20, 50],
    })
  ),
  /** Pagination UI style */
  style: Schema.optional(PaginationStyleSchema),
}).annotations({
  title: 'Pagination',
  description: 'Pagination configuration for data source',
})

/**
 * Search engine backend for data source queries.
 *
 * - `client`: JavaScript filtering in browser (default, small datasets)
 * - `fts`: PostgreSQL Full-Text Search (tsvector/tsquery, ranked results)
 * - `trigram`: PostgreSQL pg_trgm (fuzzy matching, typo-tolerance)
 * - `hybrid`: Combined FTS for relevance + trigram for fuzzy fallback
 */
export const SearchEngineSchema = Schema.Literal('client', 'fts', 'trigram', 'hybrid').annotations({
  identifier: 'SearchEngine',
  title: 'Search Engine',
  description:
    "Search backend: 'client' (browser JS), 'fts' (PostgreSQL FTS), 'trigram' (pg_trgm fuzzy), 'hybrid' (FTS + trigram)",
})

/**
 * Data source mode
 *
 * - `list`: Fetches multiple records (default)
 * - `single`: Fetches one record by route parameter
 * - `search`: Interactive search with debounce
 */
export const DataSourceModeSchema = Schema.Literal('list', 'single', 'search').annotations({
  title: 'Data Source Mode',
  description:
    "Data fetching mode: 'list' (multiple), 'single' (one record), 'search' (interactive)",
})

/**
 * Data Source Schema
 *
 * Binds a component to table data for read operations. Defines which table
 * to query, filtering, sorting, pagination, and how data is accessed.
 *
 * Three modes:
 * - **list** (default): Query multiple records with optional filter/sort/pagination
 * - **single**: Fetch one record by route parameter (e.g., `/posts/:slug`)
 * - **search**: Interactive search with debounce and field targeting
 *
 * Data is exposed to child components via `$record.*` variable references.
 *
 * @example
 * ```yaml
 * # List mode with filtering and pagination
 * dataSource:
 *   table: posts
 *   fields: [title, excerpt, author, publishedAt]
 *   filter:
 *     - field: status
 *       operator: eq
 *       value: published
 *   sort:
 *     - field: publishedAt
 *       direction: desc
 *   pagination:
 *     pageSize: 10
 *     style: numbered
 *
 * # Single record mode
 * dataSource:
 *   table: posts
 *   mode: single
 *   param: slug
 *
 * # Search mode
 * dataSource:
 *   table: products
 *   mode: search
 *   searchFields: [name, description]
 *   debounceMs: 300
 *   limit: 20
 * ```
 */
export const DataSourceSchema = Schema.Struct({
  /** Table name to query (must exist in app.tables) */
  table: Schema.String.annotations({
    description: 'Table name to bind to (validated against app.tables)',
  }),
  /** Optional subset of fields to fetch (validated against table schema) */
  fields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Specific fields to fetch from the table',
        examples: [['title', 'author', 'createdAt']],
      })
    )
  ),
  /** Data fetching mode */
  mode: Schema.optional(DataSourceModeSchema),
  /** Filter conditions (AND logic) */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotations({
      description: 'Filter conditions applied with AND logic',
    })
  ),
  /** Sort rules (applied in order) */
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotations({
      description: 'Sort rules applied in order',
    })
  ),
  /** Pagination configuration (list mode only) */
  pagination: Schema.optional(PaginationSchema),
  /** Route parameter name for single-record mode */
  param: Schema.optional(
    Schema.String.annotations({
      description: 'Route parameter name for single mode (e.g., slug, id)',
      examples: ['slug', 'id'],
    })
  ),
  /** Search engine backend (search mode only) */
  searchEngine: Schema.optional(
    SearchEngineSchema.annotations({
      description:
        "Search backend for this data source (default: 'client'). Same table can use different engines on different pages.",
    })
  ),
  /** Fields to search across (search mode only) */
  searchFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Fields to search across in search mode',
        examples: [['name', 'description']],
      })
    )
  ),
  /** Debounce delay for search input in milliseconds */
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
  /** Maximum number of results (search mode) */
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
  /** ID of the target data source for cross-component references */
  targetId: Schema.optional(
    Schema.String.annotations({
      description: 'Identifier for cross-component data source references',
    })
  ),
  /** ID of a searchInput component to bind results to */
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

/** @public */
export type DataSource = Schema.Schema.Type<typeof DataSourceSchema>
export type DataFilter = Schema.Schema.Type<typeof DataFilterSchema>
export type DataSort = Schema.Schema.Type<typeof DataSortSchema>
/** @public */
export type Pagination = Schema.Schema.Type<typeof PaginationSchema>
/** @public */
export type FilterOperator = Schema.Schema.Type<typeof FilterOperatorSchema>
/** @public */
export type SortDirection = Schema.Schema.Type<typeof SortDirectionSchema>
/** @public */
export type PaginationStyle = Schema.Schema.Type<typeof PaginationStyleSchema>
/** @public */
export type DataSourceMode = Schema.Schema.Type<typeof DataSourceModeSchema>
/** @public */
export type SearchEngine = Schema.Schema.Type<typeof SearchEngineSchema>
