/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const RowLevelFilterOperatorSchema = Schema.Literal('eq', 'neq', 'in').pipe(
  Schema.annotations({
    title: 'Row-Level Filter Operator',
    description: 'Operator for row-level permission predicates: eq, neq, or in (array membership)',
  })
)

export type RowLevelFilterOperator = Schema.Schema.Type<typeof RowLevelFilterOperatorSchema>

export const RowLevelPredicateSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Table field (or relation chain like "project.client_id") to filter on',
    })
  ),
  operator: RowLevelFilterOperatorSchema,
  value: Schema.Union(
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Array(Schema.String),
    Schema.Array(Schema.Number),
    Schema.Struct({
      kind: Schema.Literal('currentUser'),
      path: Schema.Union(
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
      ),
    })
  ).pipe(
    Schema.annotations({
      description: 'Literal value or $currentUser reference (resolved per-request from session)',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'RowLevelPredicate',
    title: 'Row-Level Predicate',
    description:
      'Server-side row-level filter that runs at the API layer. Combined with table permissions for defense-in-depth.',
  })
)

export type RowLevelPredicate = Schema.Schema.Type<typeof RowLevelPredicateSchema>

export interface RowLevelPredicateGroup {
  readonly logic?: 'and' | 'or'
  readonly conditions: ReadonlyArray<RowLevelPredicate | RowLevelPredicateGroup>
}

export const RowLevelPredicateGroupSchema: Schema.Schema<RowLevelPredicateGroup> = Schema.Struct({
  logic: Schema.optional(
    Schema.Literal('and', 'or').pipe(
      Schema.annotations({
        description:
          'Logical operator: and (all conditions must match) or or (any condition matches). Default: and',
      })
    )
  ),
  conditions: Schema.Array(
    Schema.Union(
      RowLevelPredicateSchema,
      Schema.suspend((): Schema.Schema<RowLevelPredicateGroup> => RowLevelPredicateGroupSchema)
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'One or more predicates (each a triple or a nested group) to combine',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'RowLevelPredicateGroup',
    title: 'Row-Level Predicate Group',
    description:
      'Composite AND/OR group of row-level predicates. A record passes when the group evaluates true.',
  })
)

export const RowLevelWhenSchema = Schema.Union(
  RowLevelPredicateSchema,
  RowLevelPredicateGroupSchema
).pipe(
  Schema.annotations({
    identifier: 'RowLevelWhen',
    title: 'Row-Level When Predicate',
    description: 'A single predicate triple or a composite AND/OR predicate group.',
  })
)

export type RowLevelWhen = Schema.Schema.Type<typeof RowLevelWhenSchema>

export const RowLevelPermissionsSchema = Schema.Struct({
  read: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  write: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  create: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
  delete: Schema.optional(Schema.Struct({ when: RowLevelWhenSchema })),
}).pipe(
  Schema.annotations({
    identifier: 'RowLevelPermissions',
    title: 'Row-Level Permissions',
    description:
      'Server-side row-level predicates per CRUD op. Unauthorized access returns 404, not 403, to prevent enumeration.',
  })
)

export type RowLevelPermissions = Schema.Schema.Type<typeof RowLevelPermissionsSchema>
