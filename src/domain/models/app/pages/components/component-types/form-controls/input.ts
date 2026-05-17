/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InputTypeSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const InputTypeLiteral = Schema.Literal('input')

export const inputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  inputType: Schema.optional(InputTypeSchema),
} as const
