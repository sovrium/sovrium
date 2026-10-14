/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ButtonGroupTypeLiteral = Schema.Literal('button-group')

/** Which way the grouped controls run. */
export const ButtonGroupOrientationSchema = Schema.Literals(['horizontal', 'vertical']).annotate({
  title: 'Button Group Orientation',
  description:
    "Which way the grouped controls run: 'horizontal' (the default) in one joined row, or 'vertical' in one joined column, such as a zoom control. shadcn/ui's Button Group orientation.",
})

export const buttonGroupFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Which way the grouped controls run; a row when omitted. */
  orientation: Schema.optional(ButtonGroupOrientationSchema),
} as const
