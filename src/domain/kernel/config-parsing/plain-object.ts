/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one plain-object guard for reading config- and JSON-shaped values: an
 * action's props, a step's data, a template reference. Every reader that walks
 * such a value asks the same question, and a private copy per module is how
 * one of them comes to admit an array the others refuse.
 */

/** A props object, or any JSON-shaped object a reader walks. */
export type Raw = Readonly<Record<string, unknown>>

/** Whether a value is a plain object (not `null`, not an array). */
export const isRecord = (value: unknown): value is Raw =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
