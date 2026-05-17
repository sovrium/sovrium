/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const SpinnerTypeLiteral = Schema.Literal('spinner')

export const spinnerFields = {
  ...coreFields,
  ...visibilityFields,
} as const
