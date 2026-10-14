/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ToggleTypeSchema } from '../../form-controls'
import { ComponentSizeSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ToggleTypeLiteral = Schema.Literal('toggle')

/** shadcn/ui Toggle's two looks. */
export const ToggleVariantSchema = Schema.Literals(['default', 'outline']).annotate({
  title: 'Toggle Variant',
  description:
    "The toggle's look: 'default' (borderless, the default) or 'outline' (drawn with a border). shadcn/ui's Toggle variant.",
})

export const toggleFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  pressed: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Default pressed/active state for toggle',
    })
  ),
  toggleType: Schema.optional(ToggleTypeSchema),
  size: Schema.optional(ComponentSizeSchema),
  /** The toggle's look; borderless when omitted. */
  toggleVariant: Schema.optional(ToggleVariantSchema),
} as const
