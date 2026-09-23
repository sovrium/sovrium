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
export const FilterOperatorSchema = Schema.Literals([
  'eq',
  'neq',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
]).annotate({
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
export const CurrentUserPathSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('scalar'),
    name: Schema.Literals(['id', 'email', 'role', 'isUnrestricted']).annotate({
      description: 'Which property of the signed-in person the value is taken from.',
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('assignment'),
    tableSlug: Schema.String.annotate({
      description: 'Table the signed-in person is assigned through.',
    }).pipe(Schema.check(Schema.isMinLength(1))),
  }),
  Schema.Struct({
    kind: Schema.Literal('activeAssignment'),
  }),
]).annotate({
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
}).annotate({
  identifier: 'CurrentUserRef',
  title: 'Current-User Reference',
  description:
    'Server-resolved reference to the authenticated user. Resolved per-request, never cached across users.',
})

export type CurrentUserRef = Schema.Schema.Type<typeof CurrentUserRefSchema>

/**
 * Route-parameter reference — discriminated value used in
 * `dataSource.filter[].value`.
 *
 * `name` is a segment declared by the host page's `path` (`/items/:group` →
 * `group`). At request time the resolver substitutes the matched segment value,
 * so ONE page definition filters differently per URL. It is the ROUTE sibling of
 * {@link CurrentUserRefSchema}: same position in the filter-value union, same
 * server-side resolution, a different source of truth for the value.
 *
 * A reference naming a segment the page's `path` does not declare is rejected at
 * DECODE time, so `sovrium validate` catches the typo offline instead of the
 * page silently filtering on an undefined value.
 */
export const RouteParamRefSchema = Schema.Struct({
  kind: Schema.Literal('routeParam'),
  name: Schema.String.annotate({
    description: 'Name of the route parameter whose value is read from the page address.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'RouteParamRef',
  title: 'Route Parameter Reference',
  description:
    "Server-resolved reference to a segment of the host page's path (e.g. :group). Resolved per-request from the matched route.",
})

/** @public */
export type RouteParamRef = Schema.Schema.Type<typeof RouteParamRefSchema>

/**
 * Literal filter value — JSON-serializable scalar or array of scalars.
 *
 * Arrays are accepted to support the `in` operator (e.g. when comparing a
 * field against the resolved record-id list from
 * `$currentUser.assignments.<table>`).
 */
export const FilterLiteralSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Finite),
])

/**
 * Filter value — a literal, a `$currentUser` reference, or a `$param` reference.
 *
 * String-template sugar (a template is a plain string here — the union's
 * `FilterLiteralSchema` branch accepts it — and is normalized by the resolver at
 * request time, exactly as `$currentUser.*` already is):
 * - `'$currentUser.id'` -> `{ kind: 'currentUser', path: { kind: 'scalar', name: 'id' } }`
 * - `'$currentUser.assignments.<table>'` -> `{ kind: 'currentUser', path: { kind: 'assignment', tableSlug: '<table>' } }`
 * - `'$currentUser.activeAssignment'` -> `{ kind: 'currentUser', path: { kind: 'activeAssignment' } }`
 * - `'$param.<name>'` -> `{ kind: 'routeParam', name: '<name>' }`
 */
export const FilterValueSchema = Schema.Union([
  FilterLiteralSchema,
  CurrentUserRefSchema,
  RouteParamRefSchema,
])

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
  field: Schema.String.annotate({
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
  value: FilterValueSchema.annotate({
    description:
      'Literal value, $currentUser reference, or template string. $currentUser refs resolve per-request from session.',
  }),
}).annotate({
  title: 'Data Filter',
  description: 'Single filter condition for data source queries',
})

/**
 * Sort direction for data source queries
 */
export const SortDirectionSchema = Schema.Literals(['asc', 'desc']).annotate({
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
  field: Schema.String.annotate({
    description: 'Field name to sort by',
  }),
  /** Sort direction */
  direction: SortDirectionSchema,
}).annotate({
  title: 'Data Sort',
  description: 'Single sort rule for data source queries',
})

/**
 * How the reader reaches the records past the first page.
 *
 * **An omitted `style` means `numbered`**, and that default is load-bearing
 * rather than cosmetic: `pageSize` alone already narrows what a component DRAWS,
 * so a style that renders no control leaves the remaining records unreachable —
 * a config that silently hides rows rather than paging them. Every consumer
 * therefore draws a pager unless it was asked for `loadMore`.
 *
 * `infinite` is accepted by this vocabulary and is deliberately NOT implemented
 * — see `src/presentation/islands/list/list-island.tsx`, which states the reason
 * at the point a reader meets it: scroll-triggered paging needs a sentinel row,
 * an intersection observer and a re-entrancy guard, and none of that can be
 * called shipped until something specifies how it behaves at the end of the set.
 * A component declaring it therefore pages exactly as `numbered` does. That
 * fallback is the whole point: the refusal costs the reader a nicer interaction,
 * never a record.
 */
export const PaginationStyleSchema = Schema.Literals(['numbered', 'loadMore', 'infinite']).annotate(
  {
    title: 'Pagination Style',
    description:
      'How pagination controls are displayed (default: numbered). `infinite` is accepted but not implemented and pages as `numbered`.',
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
  pageSize: Schema.Finite.pipe(
    Schema.annotate({
      description: 'Number of records per page',
      examples: [10, 20, 50],
    }),
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),
  /** Pagination UI style — omitted means `numbered`, never "no control" */
  style: Schema.optional(PaginationStyleSchema),
}).annotate({
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
export const SearchEngineSchema = Schema.Literals(['client', 'fts', 'trigram', 'hybrid']).annotate({
  identifier: 'SearchEngine',
  title: 'Search Engine',
  description:
    "Search backend. Only 'client' (browser JS over the fetched rows) is implemented and it is the default; 'fts', 'trigram' and 'hybrid' are reserved names that validate and behave exactly like 'client' until the server-side engines land.",
})

/**
 * Data source mode
 *
 * - `list`: Fetches multiple records (default)
 * - `single`: Fetches one record by route parameter
 * - `search`: Interactive search with debounce
 */
export const DataSourceModeSchema = Schema.Literals(['list', 'single', 'search']).annotate({
  title: 'Data Source Mode',
  description:
    "Data fetching mode: 'list' (multiple), 'single' (one record), 'search' (interactive)",
})

/**
 * Data source refresh mode
 *
 * Controls how a data-bound component keeps its data in sync after the
 * initial load:
 *
 * - `none` (default): Data is fetched once on load; no further refresh.
 * - `poll`: The component re-fetches on a fixed interval (see
 *   `pollIntervalMs`).
 * - `realtime`: The component subscribes to live change events for the
 *   bound table and refreshes when records change.
 *
 * Works with all data source modes (`list`, `single`, `search`) and every
 * section type that uses a `dataSource` (data-table, list, chart, kanban,
 * calendar, kpi, gallery, form).
 */
export const RefreshModeSchema = Schema.Literals(['none', 'poll', 'realtime']).annotate({
  identifier: 'RefreshMode',
  title: 'Refresh Mode',
  description:
    "Data refresh strategy: 'none' (fetch once), 'poll' (fixed interval), 'realtime' (live change events)",
})

/** @public */
export type RefreshMode = Schema.Schema.Type<typeof RefreshModeSchema>

/**
 * Shared-filter binding — the param-mapping companion to `bindTo`.
 *
 * When a data source carries `sharedFilter`, its `bindTo` reference is treated
 * as a SHARED FILTER / PERIOD publisher (a sibling selector / filter / period
 * control) rather than a `search-input`: the publisher's current value is
 * published as a request-param bag and merged into EVERY request this data
 * source issues — to its DB table OR its `system.endpoint` — as the DYNAMIC
 * counterpart to a system source's static `query`. ONE publisher can drive MANY
 * sibling subscribers (e.g. a period selector shared by a KPI strip, a
 * timeseries chart and a top-pages table; or an automation/status filter bar
 * driving a runs `table`).
 *
 * This is purely additive: it reuses the existing `bindTo` id-reference (it does
 * NOT introduce a second publisher-id namespace) and is INERT when `bindTo` is
 * absent — mirroring how `pollIntervalMs` is silently ignored without
 * `refreshMode: poll`.
 *
 * @example
 * ```yaml
 * # A runs grid that merges a sibling filter bar's { automationName, status } bag
 * dataSource:
 *   system:
 *     endpoint: /api/admin/automations/runs
 *     bindTo: runs-filter        # the sibling filter publisher's component id
 *     sharedFilter: {}           # merge the publisher's full param bag verbatim
 *
 * # A top-pages table consuming only from/to of a from/to/granularity period bag
 * dataSource:
 *   system:
 *     endpoint: /api/analytics/pages
 *     bindTo: period
 *     sharedFilter:
 *       params: [from, to]       # consume a SUBSET of the shared bag
 * ```
 */
export const SharedFilterBindingSchema = Schema.Struct({
  /**
   * Request-param key(s) this subscriber contributes from the bound publisher's
   * value. A scalar publisher (e.g. a `search-input`) maps its value to the named
   * param(s); a multi-value selector publishes a param bag and `params` selects
   * which of its keys this subscriber merges. Omit to merge the publisher's full
   * param bag verbatim.
   */
  params: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'One request-param key, as the bound publisher names it',
      })
    ).pipe(
      Schema.annotate({
        description:
          "Request-param keys this subscriber consumes from the shared publisher's value bag (omit to merge the full bag verbatim)",
        examples: [['status'], ['automationName', 'status'], ['from', 'to']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'SharedFilterBinding',
  title: 'Shared Filter Binding',
  description:
    "Companion to bindTo: marks the bound component as a shared filter/period publisher whose published params are merged into this data source's request (the dynamic counterpart to a system source's static query).",
})

/** @public */
export type SharedFilterBinding = Schema.Schema.Type<typeof SharedFilterBindingSchema>

/**
 * Shared-filter PUBLISHER — the half `SharedFilterBindingSchema` subscribes to.
 *
 * ─── WHY THE SUBSCRIBER HALF ALONE IS NOT A FEATURE ────────────────────────
 *
 * `bindTo` + `sharedFilter` describes a component that CONSUMES a published
 * param bag, and the only thing that publishes one today is either a
 * `search-input` (a scalar, under its own component id) or a bespoke island with
 * no component type at all — `shared-filter-select`, which the automation-runs
 * console mounts from TypeScript. So a config author can declare a subscriber
 * and has no way to declare what it listens to. This is the missing half.
 *
 * ─── ONE CHANNEL, MANY CONTRIBUTORS ────────────────────────────────────────
 *
 * `bindTo` here names the CHANNEL the control publishes on — deliberately the
 * same key name a subscriber uses, because it is deliberately the same string,
 * and a validator comparing `bindTo` to `bindTo` is one a reader can check by
 * eye. It is NOT the publisher's own component id: the runs directory needs TWO
 * selectors ("Filter by automation", "Filter by status") driving ONE grid, and a
 * subscriber's `bindTo` names a single channel. Both selectors publish on
 * `runs-filter`, each contributing its own `param`, and the grid merges the bag.
 *
 * Making the channel explicit rather than defaulting to the control's `props.id`
 * is the point: a select's id is also its form-control id, and overloading it
 * would silently make every id-bearing select a publisher, with collisions
 * decided by whichever rendered last.
 *
 * ─── PUBLISHED, NOT REQUESTED ──────────────────────────────────────────────
 *
 * The publisher emits on the client bus; the subscriber's own `sharedFilter`
 * decides which keys it merges. So a channel may carry more than any one
 * subscriber consumes, which is what lets a period channel drive a KPI strip
 * reading `[from, to]` beside a chart reading `[from, to, granularity]`.
 *
 * @example
 * ```yaml
 * # Two selects on one channel
 * - type: select
 *   props: { id: automation-filter, label: Filter by automation }
 *   dataSource:
 *     system: { endpoint: /api/admin/automations, rowsKey: automations }
 *     valueKey: name
 *     labelKey: name
 *   publishes: { bindTo: runs-filter, param: automationName }
 * - type: select
 *   props: { id: status-filter, label: Filter by status }
 *   options: [{ value: completed, label: Success }, { value: failed, label: Failed }]
 *   publishes: { bindTo: runs-filter, param: status }
 * # ...and the grid that merges both
 * - type: table
 *   dataSource:
 *     system:
 *       endpoint: /api/admin/automations/runs
 *       bindTo: runs-filter
 *       sharedFilter: {}
 * ```
 */
export const SharedFilterPublisherSchema = Schema.Struct({
  /**
   * The shared-filter CHANNEL this control publishes on — the same string a
   * subscriber's `bindTo` names. Several controls may share one channel, each
   * contributing its own `param`.
   */
  bindTo: Schema.String.pipe(
    Schema.annotate({
      description:
        "Shared-filter channel id this control publishes on (the string a subscriber's bindTo names)",
      examples: ['runs-filter', 'period'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /**
   * The request-param key this control's current value is published under.
   *
   * Required, for the reason `labelKey` and `displayField` are: there is no
   * defensible default. Guessing the control's `props.id` would publish
   * `?automation-filter=` to an endpoint that reads `?automationName=`, which is
   * a filter that validates and quietly narrows nothing.
   */
  param: Schema.String.pipe(
    Schema.annotate({
      description: "Request-param key this control's value is published under",
      examples: ['automationName', 'status', 'period'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'SharedFilterPublisher',
  title: 'Shared Filter Publisher',
  description:
    'Marks a choice control as a shared-filter publisher: its current value is published on the named channel under `param`, and every data source whose bindTo names that channel merges it into each request.',
})

/** @public */
export type SharedFilterPublisher = Schema.Schema.Type<typeof SharedFilterPublisherSchema>

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
  /**
   * Table to query — a declared name, or a `$param.<name>` reference naming a
   * segment of the host page's `path`.
   *
   * A literal name is cross-validated against `app.tables` at config load, on
   * EVERY component that spreads this schema — `validateTableNameReferences`,
   * run by the shared decode pipeline, so `validate`, `start` and `build` reach
   * the same verdict.
   *
   * It used to be checked only when that component was a `table`:
   * `validateDbTableColumns` was the one validator that rejected an unknown
   * name, and the walker feeding it (`collectDataTableComponents`) filters on
   * `type === 'table'`. So under a `kpi`, `chart`, `kanban`, `calendar`,
   * `gallery`, `list`, `timeline`, `container`, `form` or `record-field` an
   * undeclared name decoded clean and rendered an empty component, while the
   * generic pass that DOES visit them (`validateComponentFieldReferences`)
   * skipped it, deferring to a rule that never ran for it. [internal ref]..038
   * closed that by keying the rule on the SHAPE that binds a table rather than
   * on the component type carrying it, which is what makes the `description`
   * below true rather than aspirational.
   *
   * A ROUTE
   * REFERENCE deliberately is not, and cannot be: which table `/records/:table`
   * binds to is a fact about the request, not about the config, so the only
   * offline question worth asking is whether the page's own path declares the
   * segment — which `collectPageBindingViolations` does ask, naming the
   * reference and the path. At request time a segment naming no declared table
   * 404s the page rather than rendering an empty grid, because "this table does
   * not exist" and "this table is empty" must not look the same.
   *
   * The reference is what makes ONE page definition a records explorer over
   * every table an app declares; pair it with `columnsFrom: table` on the grid,
   * which cannot enumerate columns it will only learn at request time either.
   */
  table: Schema.String.annotate({
    description:
      'Table to bind to: a declared name (validated against app.tables), or a $param.<name> route reference declared by the page path',
    examples: ['posts', '$param.table'],
  }),
  /** Optional subset of fields to fetch (validated against table schema) */
  fields: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'One field name, spelled as the bound table declares it',
      })
    ).pipe(
      Schema.annotate({
        description: 'Specific fields to fetch from the table',
        examples: [['title', 'author', 'createdAt']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Data fetching mode */
  mode: Schema.optional(DataSourceModeSchema),
  /** Filter conditions (AND logic) */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description: 'Filter conditions applied with AND logic',
    })
  ),
  /** Sort rules (applied in order) */
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotate({
      description: 'Sort rules applied in order',
    })
  ),
  /** Pagination configuration (list mode only) */
  pagination: Schema.optional(PaginationSchema),
  /** Route parameter name for single-record mode */
  param: Schema.optional(
    Schema.String.annotate({
      description: 'Route parameter name for single mode (e.g., slug, id)',
      examples: ['slug', 'id'],
    })
  ),
  /** Search engine backend (search mode only) */
  searchEngine: Schema.optional(
    SearchEngineSchema.annotate({
      description:
        "Search backend for this data source (default: 'client'). Only 'client' is dispatched today; the other three validate and search as 'client' does.",
    })
  ),
  /** Fields to search across (search mode only) */
  searchFields: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'One field name the search term is matched against',
      })
    ).pipe(
      Schema.annotate({
        description: 'Fields to search across in search mode',
        examples: [['name', 'description']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Debounce delay for search input in milliseconds */
  debounceMs: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Debounce delay for search input (ms)',
        examples: [300, 500],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  /** Maximum number of results (search mode) */
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Maximum number of results to return',
        examples: [10, 20, 50],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Publisher-side identifier for cross-component references */
  targetId: Schema.optional(
    Schema.String.annotate({
      description:
        "Publisher-side identifier for cross-component references — addressable by a FilterAction (targetDataSource) and by a sibling subscriber's bindTo (shared filter/period state)",
    })
  ),
  /** ID of a publisher component whose value drives this data source */
  bindTo: Schema.optional(
    Schema.String.annotate({
      description:
        'ID of a publisher component whose value drives this data source (cross-component binding). By default a `search-input` whose query string drives the search; when sharedFilter is also set, a shared filter/period selector whose published params are merged into every request',
    })
  ),
  /**
   * Shared-filter param mapping (companion to `bindTo`). When set, `bindTo`
   * references a shared filter/period selector (not a `search-input`) whose
   * published params are merged into every request. Inert without `bindTo`.
   */
  sharedFilter: Schema.optional(
    SharedFilterBindingSchema.annotate({
      description:
        'Companion to bindTo: the bound publisher is a shared filter/period selector whose published params are merged into every request this data source issues. One selector can drive many sibling subscribers. Inert without bindTo.',
    })
  ),
  /** How the bound data is refreshed after the initial load (default: none) */
  refreshMode: Schema.optional(
    RefreshModeSchema.annotate({
      description:
        "Data refresh strategy for this binding (default: 'none'). 'poll' uses pollIntervalMs; 'realtime' subscribes to live change events.",
    })
  ),
  /**
   * Poll interval in milliseconds (used when `refreshMode` is `poll`).
   *
   * Must be between 1000 (1s minimum, prevents request floods) and 300000
   * (5min maximum). Defaults to 30000 (30s) when `refreshMode` is `poll` and
   * no interval is specified. Silently ignored when `refreshMode` is not
   * `poll`.
   */
  pollIntervalMs: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          "Polling interval in milliseconds for refreshMode: poll (min 1000, max 300000). Defaults to 30000 when omitted, and is ignored unless refreshMode is 'poll'.",
        defaultNote: '30000',
        examples: [3000, 5000, 10_000],
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 300_000 }))
    )
  ),
}).annotate({
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
