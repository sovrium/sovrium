/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const SidebarTypeLiteral = Schema.Literal('sidebar')

export const sidebarFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
} as const
