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

export const StatusIndicatorTypeLiteral = Schema.Literal('status-indicator')

export const statusIndicatorFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  status: Schema.optional(
    Schema.String.annotations({
      description: 'Status label text displayed next to the dot',
    })
  ),
  statusColor: Schema.optional(
    Schema.String.annotations({
      description: 'Color for the status dot (CSS color value or theme token name)',
    })
  ),
  pulse: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable pulsing animation on the status dot',
    })
  ),
} as const
