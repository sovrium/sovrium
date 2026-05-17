/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
  /** Show a confirmation prompt before executing the action */
  confirm: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  /** Custom confirmation message to display (requires confirm: true) */
  confirmMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Are you sure you want to delete this record?'],
    })
  ),
  /** Static data payload for bulk update operations */
  data: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).annotations({
      description: 'Field values to apply in bulk update operations',
      examples: [{ status: 'shipped' }, { archived: true }],
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'CRUD Action',
  description: 'Data operation action (create, update, delete)',
})

/**
 * Automation action - invoke a named automation
 *
 * @example
 * ```yaml
 * action:
 *   type: automation
 *   name: generate-monthly-report
 *   inputData:
 *     month: '$currentMonth'
 *     format: pdf
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report generated!
 *       variant: success
 *     navigate: /reports
 * ```
 */
export const AutomationActionSchema = Schema.Struct({
  type: Schema.Literal('automation'),
  /** Automation name (must match an automation defined in app.automations) */
  name: Schema.String.annotations({
    description: 'Automation name (must match an automation defined in app.automations)',
  }),
  /** Key-value pairs passed to the automation as input */
  inputData: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).annotations({
      description:
        'Key-value pairs passed to the automation as input. Supports $variable references.',
    })
  ),
  /** Whether to wait for completion before triggering response */
  await: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Wait for completion before triggering response (default: false = fire-and-forget)',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Automation Action',
  description: 'Invoke a named automation from a page component (button click, form submit)',
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
 * Navigate Action
 *
 * Pure navigation primitive — first-class for callers (e.g. Kanban card
 * `onClick`) that just want to move the user to a new page without a
 * mutation side-effect. `crud` actions can already navigate via their
 * `onSuccess.navigate` response, but that path is overloaded with a
 * mutation; this variant is the navigate-only shape.
 *
 * `path` supports `$record.X` substitution at render time so
 * row-bound elements (cards, table rows) can navigate to a per-record
 * destination.
 *
 * @example
 * ```yaml
 * # Card onClick to record detail
 * onClick:
 *   type: navigate
 *   path: '/tasks/$record.id'
 *
 * # Static path
 * onClick:
 *   type: navigate
 *   path: '/dashboard'
 * ```
 */
export const NavigateActionSchema = Schema.Struct({
  type: Schema.Literal('navigate'),
  /** Destination URL path. Supports `$record.X` substitution. */
  path: Schema.String.annotations({
    description: 'Destination URL path (supports $record.X substitution)',
  }),
  /** Optional success handler (rarely used for pure navigation). */
  onSuccess: Schema.optional(ActionResponseSchema),
  /** Optional error handler (e.g. router rejection). */
  onError: Schema.optional(ActionResponseSchema),
}).annotations({
  title: 'Navigate Action',
  description: 'Pure navigation action — no mutation side-effect',
})

/**
 * Action Schema
 *
 * Discriminated union of action types that can be triggered by components.
 * The `type` field determines the action variant:
 *
 * - **auth**: Authentication operations (login, signup, logout, etc.)
 * - **crud**: Data operations (create, update, delete)
 * - **automation**: Invoke a named automation workflow
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
 * # Trigger automation
 * action:
 *   type: automation
 *   name: generate-report
 *   inputData:
 *     month: '$currentMonth'
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report ready!
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
  AutomationActionSchema,
  FilterActionSchema,
  NavigateActionSchema
).pipe(
  Schema.annotations({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), automation (invoke workflow), filter (cross-component filtering), navigate (pure URL navigation).',
  })
)

/** @public */
export type Action = Schema.Schema.Type<typeof ActionSchema>
/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
/** @public */
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
/** @public */
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>
/** @public */
export type FilterAction = Schema.Schema.Type<typeof FilterActionSchema>
/** @public */
export type NavigateAction = Schema.Schema.Type<typeof NavigateActionSchema>
/** @public */
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
/** @public */
export type Toast = Schema.Schema.Type<typeof ToastSchema>
/** @public */
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
