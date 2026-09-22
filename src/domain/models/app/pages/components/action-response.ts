/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SuccessPageActionSchema } from '../../forms/on-success'

/**
 * Toast notification variant
 */
export const ToastVariantSchema = Schema.Literals(['success', 'error', 'warning', 'info']).annotate(
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
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      })
    )
  ),
}).annotate({
  title: 'Toast',
  description: 'Toast notification configuration',
})

/**
 * Action response behavior type
 *
 * Controls what happens to the form after a successful action:
 *
 * - `navigate`: Navigate to the `navigate` path (default when `navigate` is set)
 * - `reset`: Clear the form fields to their default values for rapid repeat entry.
 *   `preserveFields` may be used to retain selected field values across the reset.
 * - `message`: Show only the inline toast/message; the form keeps its values
 * - `successPage`: Replace the form with a custom success page (title, message,
 *   action buttons, optional summary of submitted values, optional redirect)
 * - `role-landing`: Navigate to the app's configured `auth.landingPath` so the
 *   existing per-role landing resolver redirects each authenticated user to
 *   their own `auth.roles[].defaultLanding`. Lets a SINGLE login form land
 *   different roles on different pages without a hardcoded `navigate` path.
 *   Only meaningful on a `type: auth`, `method: login` action and requires
 *   `auth.landingPath` (plus per-role `defaultLanding`) to be configured.
 */
export const ActionResponseTypeSchema = Schema.Literals([
  'navigate',
  'reset',
  'message',
  'successPage',
  'role-landing',
]).annotate({
  title: 'Action Response Type',
  description:
    'Form behavior after a successful action (navigate, reset, message, successPage, role-landing)',
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
 *
 * # Quick-entry form that resets after every submission
 * onSuccess:
 *   type: reset
 *   preserveFields: [category, location]
 *   toast:
 *     message: Item added!
 *     variant: success
 *
 * # Replace the form with a custom success page after submission
 * onSuccess:
 *   type: successPage
 *   title: Thank you!
 *   message: Your response has been recorded.
 *   showSummary: true
 *   actions:
 *     - { label: Submit another, action: reset }
 *     - { label: Go home, action: navigate, url: / }
 *
 * # Single login form, per-role landing — each role lands on its own
 * # auth.roles[].defaultLanding via the engine's landingPath resolver
 * onSuccess:
 *   type: role-landing
 *   toast:
 *     message: Welcome back!
 *     variant: success
 * ```
 */
export const ActionResponseSchema = Schema.Struct({
  /** Behavior type — defaults to `navigate` when `navigate` is set */
  type: Schema.optional(ActionResponseTypeSchema),
  /** Path to navigate to after action */
  navigate: Schema.optional(
    Schema.String.annotate({
      description: 'URL path to navigate to. Supports $variable references.',
      examples: ['/dashboard', '/posts/$record.slug'],
    })
  ),
  /**
   * Field names whose values are retained after a `type: reset` response.
   * All other fields are cleared to their default values. Only meaningful
   * when `type` is `reset`.
   */
  preserveFields: Schema.optional(
    Schema.Array(Schema.String).annotate({
      description:
        'Field names retained after a reset. Only meaningful when type is "reset". All other fields are cleared.',
      examples: [
        ['category', 'location'],
        ['project', 'date'],
      ],
    })
  ),
  /**
   * Heading shown on the success page. Only meaningful when `type` is
   * `successPage`. Supports `$variable` references.
   */
  title: Schema.optional(
    Schema.String.annotate({
      description: 'Success page heading. Only meaningful when type is "successPage".',
      examples: ['Thank you for your feedback!', 'Ticket Created'],
    })
  ),
  /**
   * Body message shown below the heading on the success page. Only meaningful
   * when `type` is `successPage`. Supports `$variable` references.
   */
  message: Schema.optional(
    Schema.String.annotate({
      description: 'Success page body message. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * Action buttons rendered on the success page (`reset` and/or `navigate`).
   * Only meaningful when `type` is `successPage`. Shares the
   * `SuccessPageAction` shape with the standalone Forms feature.
   */
  actions: Schema.optional(
    Schema.Array(SuccessPageActionSchema).annotate({
      description: 'Success page action buttons. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * When `true`, the success page lists a read-only summary of the submitted
   * field values. Only meaningful when `type` is `successPage`.
   */
  showSummary: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Render a read-only summary of submitted values on the success page. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * URL to navigate to after the success page is shown (after a short delay).
   * May interpolate `$record.id` (and other `$record.X` fields) resolved from
   * the created/updated record. Only meaningful when `type` is `successPage`.
   */
  redirect: Schema.optional(
    Schema.String.annotate({
      description:
        'URL navigated to after the success page is shown. Supports $record.X interpolation. Only meaningful when type is "successPage".',
      examples: ['/support/tickets/$record.id'],
    })
  ),
  /** Toast notification to show */
  toast: Schema.optional(ToastSchema),
}).annotate({
  title: 'Action Response',
  description: 'Defines behavior after action success or failure',
})

/** @public */
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
/** @public */
export type ActionResponseType = Schema.Schema.Type<typeof ActionResponseTypeSchema>
/** @public */
export type Toast = Schema.Schema.Type<typeof ToastSchema>
/** @public */
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
