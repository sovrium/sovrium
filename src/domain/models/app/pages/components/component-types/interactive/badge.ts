/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BadgeVariantSchema } from '../../shared-schemas'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { visibilityFields } from '../modules/visibility'

export const BadgeTypeLiteral = Schema.Literal('badge')

export const BadgeModeSchema = Schema.Literal('status').annotations({
  title: 'Badge Mode',
  description: 'Specialized rendering mode for badge (e.g. status indicator)',
})

export const StatusDotColorSchema = Schema.Literal(
  'green',
  'red',
  'amber',
  'yellow',
  'blue',
  'gray'
).annotations({
  title: 'Status Dot Color',
  description: 'Color token for the status-indicator dot',
})

export const badgeFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...visibilityFields,
  ...i18nFields,
  badgeVariant: Schema.optional(BadgeVariantSchema),
  variant: Schema.optional(BadgeModeSchema),
  status: Schema.optional(
    Schema.String.annotations({
      description: 'Status label text displayed next to the dot (variant: status)',
    })
  ),
  statusColor: Schema.optional(StatusDotColorSchema),
  pulse: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable pulsing animation on the status dot (variant: status)',
    })
  ),
} as const
