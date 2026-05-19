/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'

export const ToastTypeLiteral = Schema.Literal('toast')

export const toastFields = {
  ...coreFields,
  ...contentFields,
  ...i18nFields,
} as const
