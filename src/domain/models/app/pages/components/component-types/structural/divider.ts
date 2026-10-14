/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'

export const DividerTypeLiteral = Schema.Literal('separator')

/** Which way the rule runs. */
export const SeparatorOrientationSchema = Schema.Literals(['horizontal', 'vertical']).annotate({
  title: 'Separator Orientation',
  description:
    "Which way the rule runs: 'horizontal' (the default) across the column, or 'vertical' up and down between the items of a row. shadcn/ui's Separator orientation.",
})

export const dividerFields = {
  ...coreFields,
  /** Which way the rule runs; horizontal when omitted. */
  orientation: Schema.optional(SeparatorOrientationSchema),
  /** Text set into the middle of a horizontal rule, as shadcn/ui's FieldSeparator draws "Or continue with". */
  label: Schema.optional(
    Schema.String.annotate({
      title: 'Separator Label',
      description:
        "Text set into the middle of a horizontal rule, such as 'Or continue with' between two ways to sign in. A vertical separator draws no label. shadcn/ui's FieldSeparator.",
    })
  ),
} as const
