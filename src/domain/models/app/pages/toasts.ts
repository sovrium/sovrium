/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Toast position on the page
 */
export const ToastPositionSchema = Schema.Literals([
  'top-right',
  'top-left',
  'top-center',
  'bottom-right',
  'bottom-left',
  'bottom-center',
]).annotate({
  title: 'Toast Position',
  description: 'Position of toast notifications on the page',
})

/**
 * Page-level toast configuration
 *
 * Global toast settings for a page. Individual toasts can override duration.
 *
 * @example
 * ```yaml
 * toasts:
 *   position: top-right
 *   duration: 5000
 * ```
 */
export const PageToastConfigSchema = Schema.Struct({
  /** Default position for toasts on this page */
  position: Schema.optional(ToastPositionSchema),
  /** Default auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Default toast duration in ms (default: 5000)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).annotate({
  title: 'Page Toast Config',
  description: 'Page-level toast notification configuration',
})

/** @public */
export type ToastPosition = Schema.Schema.Type<typeof ToastPositionSchema>
/** @public */
export type PageToastConfig = Schema.Schema.Type<typeof PageToastConfigSchema>
