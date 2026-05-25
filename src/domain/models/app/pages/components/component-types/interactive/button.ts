/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ButtonVariantSchema, ComponentSizeSchema } from '../../shared-schemas'
import { actionFields } from '../modules/action'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ButtonTypeLiteral = Schema.Literal('button')

export const buttonFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  variant: Schema.optional(ButtonVariantSchema),
  size: Schema.optional(ComponentSizeSchema),
  loading: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show a loading spinner inside the button' })
  ),
  label: Schema.optional(Schema.String.annotations({ description: 'Button text label' })),
  confirm: Schema.optional(
    Schema.String.annotations({ description: 'Click-time confirmation prompt' })
  ),
} as const
