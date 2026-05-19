/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AlertVariantSchema } from '../../shared-schemas'
import { actionFields } from '../modules/action'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const AlertTypeLiteral = Schema.Literal('alert')

export const alertFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  alertVariant: Schema.optional(AlertVariantSchema),
} as const
