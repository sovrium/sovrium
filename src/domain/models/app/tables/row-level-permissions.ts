/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Row-Level Permission Predicates (Z-3 — defense-in-depth)
// ---------------------------------------------------------------------------

/**
 * Row-level filter operator (subset of `FilterOperatorSchema`).
 *
 * `in` is the most common — used with `$currentUser.assignments.<table>`
 * to scope records to the assignment list. `eq` / `neq` cover ownership
 * checks against `$currentUser.id`.
 */
export const RowLevelFilterOperatorSchema = Schema.Literals(['eq', 'neq', 'in']).pipe(
  Schema.annotate({
    title: 'Row-Level Filter Operator',
    description: 'Operator for row-level permission predicates: eq, neq, or in (array membership)',
  })
)

/** @public */
export type RowLevelFilterOperator = Schema.Schema.Type<typeof RowLevelFilterOperatorSchema>

/**
 * Row-Level Predicate Schema
 *
 * A field/operator/value triple that filters records at the API layer.
 * Evaluated server-side; unauthorized direct access returns **404, not
 * 403**, to prevent enumeration (Glide / Stacker pattern).
 *
 * Values support the same `$currentUser.<path>` references as
 * `dataSource.filter` (Z-1 `FilterValueSchema`), expressed as the typed
 * discriminated union or string-template sugar.
 */
export const RowLevelPredicateSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Table field (or relation chain like "project.client_id") to filter on',
    })
  ),
  operator: RowLevelFilterOperatorSchema,
  value: Schema.Union([
    Schema.String,
    Schema.Finite,
    Schema.Boolean,
    Schema.Array(Schema.String),
    Schema.Array(Schema.Finite),
    Schema.Struct({
      kind: Schema.Literal('currentUser'),
      path: Schema.Union([
        Schema.Struct({
          kind: Schema.Literal('scalar'),
          name: Schema.Literals(['id', 'email', 'role', 'isUnrestricted']),
        }),
        Schema.Struct({
          kind: Schema.Literal('assignment'),
          tableSlug: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
        }),
        Schema.Struct({
          kind: Schema.Literal('activeAssignment'),
        }),
      ]),
    }),
  ]).pipe(
    Schema.annotate({
      description: 'Literal value or $currentUser reference (resolved per-request from session)',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'RowLevelPredicate',
    title: 'Row-Level Predicate',
    description:
      'Server-side row-level filter that runs at the API layer. Combined with table permissions for defense-in-depth.',
  })
)

export type RowLevelPredicate = Schema.Schema.Type<typeof RowLevelPredicateSchema>

/**
 * Row-Level Predicate Group Schema (GAP-3 — composite AND/OR predicates).
 *
 * A `when` predicate may be either a single `field/operator/value` triple
 * (the original form — fully backward compatible) OR a composite GROUP that
 * combines several conditions with boolean logic. A group has:
 *
 *   - `logic` — `'and'` (every condition must pass, the default) or `'or'`
 *     (any condition passes). Omitted ⇒ `'and'`.
 *   - `conditions` — one or more entries, each itself a single predicate OR a
 *     nested group (arbitrary nesting via `Schema.suspend`).
 *
 * Mirrors the automation `ConditionGroupSchema` shape. Example: a row is
 * readable if its `client_id` is in the user's clients-assignments OR its
 * `id` is in the user's projets-assignments.
 *
 * @example
 * ```yaml
 * read:
 *   when:
 *     logic: or
 *     conditions:
 *       - field: client_id
 *         operator: in
 *         value: $currentUser.assignments.clients
 *       - field: id
 *         operator: in
 *         value: $currentUser.assignments.projets
 * ```
 */
export interface RowLevelPredicateGroup {
  readonly logic?: 'and' | 'or'
  readonly conditions: ReadonlyArray<RowLevelPredicate | RowLevelPredicateGroup>
}

export const RowLevelPredicateGroupSchema: Schema.Codec<RowLevelPredicateGroup> = Schema.Struct({
  logic: Schema.optional(
    Schema.Literals(['and', 'or']).pipe(
      Schema.annotate({
        description:
          'Logical operator: and (all conditions must match) or or (any condition matches). Default: and',
      })
    )
  ),
  conditions: Schema.Array(
    Schema.Union([
      RowLevelPredicateSchema,
      Schema.suspend((): Schema.Codec<RowLevelPredicateGroup> => RowLevelPredicateGroupSchema),
    ])
  ).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'One or more predicates (each a triple or a nested group) to combine',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'RowLevelPredicateGroup',
    title: 'Row-Level Predicate Group',
    description:
      'Composite AND/OR group of row-level predicates. A record passes when the group evaluates true.',
  })
)

/**
 * A row-level `when` predicate: either a single triple or a composite
 * AND/OR group (GAP-3). The single-triple form is unchanged — composite
 * groups are purely additive.
 */
export const RowLevelWhenSchema = Schema.Union([
  RowLevelPredicateSchema,
  RowLevelPredicateGroupSchema,
]).pipe(
  Schema.annotate({
    identifier: 'RowLevelWhen',
    title: 'Row-Level When Predicate',
    description: 'A single predicate triple or a composite AND/OR predicate group.',
  })
)

export type RowLevelWhen = Schema.Schema.Type<typeof RowLevelWhenSchema>

/**
 * Row-Level Permissions Schema
 *
 * Optional `when` predicates per CRUD operation. When present, every
 * record-returning API call (read / write / create / delete) appends the
 * predicate as a server-side filter. A read attempt against a record
 * outside the predicate returns **404** (not 403) to avoid leaking the
 * existence of records the user cannot access.
 *
 * Combined with `tablePermissions` (role-based) for defense-in-depth: the
 * role gate runs first; the row-level predicate filters within the
 * permitted role's scope.
 *
 * @example Customers see only their own client's tickets
 * ```yaml
 * tables:
 *   - name: tickets
 *     rowLevelPermissions:
 *       read:
 *         when:
 *           field: client_id
 *           operator: in
 *           value: $currentUser.assignments.clients
 *       write:
 *         when:
 *           field: client_id
 *           operator: in
 *           value: $currentUser.assignments.clients
 * ```
 *
 * @example Authors can only edit their own posts
 * ```yaml
 * rowLevelPermissions:
 *   write:
 *     when:
 *       field: author_id
 *       operator: eq
 *       value: $currentUser.id
 *   delete:
 *     when:
 *       field: author_id
 *       operator: eq
 *       value: $currentUser.id
 * ```
 */
export const RowLevelPermissionsSchema = Schema.Struct({
  /** Records visible to the requester (filters SELECT/list/get-by-id) */
  read: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  /** Records the requester may modify (filters UPDATE) */
  write: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  /** Constraints on records the requester may insert (validates new row) */
  create: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  /** Records the requester may soft-delete */
  delete: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
}).pipe(
  Schema.annotate({
    identifier: 'RowLevelPermissions',
    title: 'Row-Level Permissions',
    description:
      'Server-side row-level predicates per CRUD op. Unauthorized access returns 404, not 403, to prevent enumeration.',
  })
)

export type RowLevelPermissions = Schema.Schema.Type<typeof RowLevelPermissionsSchema>
