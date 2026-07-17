/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const BadgeSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'Built with Sovrium Badge',
    description:
      'Controls the "Built with Sovrium" badge rendered bottom-right on all pages. Shown by default (omitted or true); set to false to remove it — removal is free forever, one config line, never license-gated.',
    examples: [true, false],
  })
)

export type Badge = typeof BadgeSchema.Type

export const isBadgeEnabled = (badge: Badge | undefined): boolean => badge !== false
