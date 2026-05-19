/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ToastPositionSchema = Schema.Literal(
  'top-right',
  'top-left',
  'top-center',
  'bottom-right',
  'bottom-left',
  'bottom-center'
).annotations({
  title: 'Toast Position',
  description: 'Position of toast notifications on the page',
})

export const PageToastConfigSchema = Schema.Struct({
  position: Schema.optional(ToastPositionSchema),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Default toast duration in ms (default: 5000)',
      })
    )
  ),
}).annotations({
  title: 'Page Toast Config',
  description: 'Page-level toast notification configuration',
})

export type ToastPosition = Schema.Schema.Type<typeof ToastPositionSchema>
export type PageToastConfig = Schema.Schema.Type<typeof PageToastConfigSchema>
