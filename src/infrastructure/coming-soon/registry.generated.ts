/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const COMING_SOON_SCHEMA_NAMES: ReadonlySet<string> = new Set([
  'CommentsComponentSchema',
  'CommentsConfigSchema',
  'FormAnalyticsSchema',
  'NotificationSchema',
])

export const COMING_SOON_DISCRIMINATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['ComponentSchema', new Set(['number-input', 'time-picker'])],
])

export const COMING_SOON_TAGS: ReadonlySet<string> = new Set(['number-input', 'time-picker'])

export const COMING_SOON_LEAF_SCHEMA_TAGS: ReadonlyMap<string, string> = new Map([])
