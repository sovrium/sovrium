/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a grid cell or a drawer entry shows for a write-only field: whether a
 * value is stored, never the value — the `_writeOnly` block the records API
 * answers, put into words.
 */
export const WRITE_ONLY_PRESENCE_LABELS = { set: 'Set', unset: 'Not set' } as const
