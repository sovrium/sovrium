/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Toast notification variant
 */
export const ToastVariantSchema = Schema.Literal('success', 'error', 'warning', 'info').annotations(
  {
    title: 'Toast Variant',
    description: 'Visual style of the toast notification',
  }
)

/**
 * Toast notification configuration
 *
 * @example
 * ```yaml
 * toast:
 *   message: Record created successfully
 *   variant: success
 * ```
 */
export const ToastSchema = Schema.Struct({
  /** Message to display */
  message: Schema.String.annotations({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotations({
  title: 'Toast',
  description: 'Toast notification configuration',
})

/**
 * Action response handler
 *
 * Defines what happens after a successful or failed action.
 *
 * @example
 * ```yaml
 * onSuccess:
 *   navigate: /dashboard
 *   toast:
 *     message: Welcome back!
 *     variant: success
 * ```
 */
export const ActionResponseSchema = Schema.Struct({
  /** Path to navigate to after action */
  navigate: Schema.optional(
    Schema.String.annotations({
      description: 'URL path to navigate to. Supports $variable references.',
      examples: ['/dashboard', '/posts/$record.slug'],
    })
  ),
  /** Toast notification to show */
  toast: Schema.optional(ToastSchema),
}).annotations({
  title: 'Action Response',
  description: 'Defines behavior after action success or failure',
})

/**
 * Auth action - authentication operations
 *
 * @example
 * ```yaml
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 * ```
 */
export const AuthActionSchema = Schema.Struct({
  type: Schema.Literal('auth'),
  /** Auth method */
  method: Schema.Literal(
    'login',
    'signup',
    'logout',
    'resetPassword',
    'setNewPassword',
    'verifyEmail'
  ).annotations({
    description: 'Authentication operation to perform',
  }),
  /** Auth strategy */
  strategy: Schema.optional(
    Schema.Literal('email', 'magicLink', 'oauth').annotations({
      description: 'Authentication strategy to use',
    })
  ),
  /** OAuth provider name (required when strategy is oauth) */
  provider: Schema.optional(
    Schema.String.annotations({
      description: 'OAuth provider name (e.g., google, github)',
      examples: ['google', 'github', 'discord'],
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Auth Action',
  description: 'Authentication action (login, signup, logout, etc.)',
})

/**
 * CRUD action - data operations
 *
 * @example
 * ```yaml
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     navigate: /posts
 *     toast:
 *       message: Post created!
 *       variant: success
 * ```
 */
export const CrudActionSchema = Schema.Struct({
  type: Schema.Literal('crud'),
  /** CRUD operation */
  operation: Schema.Literal('create', 'update', 'delete').annotations({
    description: 'Data operation to perform',
  }),
  /** Target table name (must exist in app.tables) */
  table: Schema.String.annotations({
    description: 'Table to perform the operation on',
  }),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'CRUD Action',
  description: 'Data operation action (create, update, delete)',
})

/**
 * Filter action - cross-component data filtering
 *
 * @example
 * ```yaml
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
 * ```
 */
export const FilterActionSchema = Schema.Struct({
  type: Schema.Literal('filter'),
  /** Target data source ID to apply filter to */
  targetDataSource: Schema.String.annotations({
    description: 'ID of the data source to filter (matches dataSource.targetId)',
  }),
  /** Field to filter on */
  field: Schema.String.annotations({
    description: 'Field name to apply the filter to',
  }),
  /** Filter operator */
  operator: Schema.optional(
    Schema.Literal('eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte').annotations({
      description: 'Comparison operator (defaults to eq)',
    })
  ),
}).annotations({
  title: 'Filter Action',
  description: 'Cross-component filter action targeting a data source',
})

/**
 * Action Schema
 *
 * Discriminated union of action types that can be triggered by components.
 * The `type` field determines the action variant:
 *
 * - **auth**: Authentication operations (login, signup, logout, etc.)
 * - **crud**: Data operations (create, update, delete)
 * - **filter**: Cross-component data source filtering
 *
 * @example
 * ```yaml
 * # Login form
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 *     toast:
 *       message: Welcome back!
 *       variant: success
 *
 * # Create record
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     toast:
 *       message: Post created successfully
 *       variant: success
 *
 * # Category filter dropdown
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
 * ```
 */
export const ActionSchema = Schema.Union(
  AuthActionSchema,
  CrudActionSchema,
  FilterActionSchema
).pipe(
  Schema.annotations({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), filter (cross-component filtering).',
  })
)

export type Action = Schema.Schema.Type<typeof ActionSchema>
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
export type Toast = Schema.Schema.Type<typeof ToastSchema>
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
