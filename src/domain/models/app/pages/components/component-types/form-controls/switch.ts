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

export const SwitchTypeLiteral = Schema.Literal('switch')

export const switchFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  checked: Schema.optional(
    Schema.Boolean.annotations({ description: 'Default checked state for checkbox or switch' })
  ),
} as const
