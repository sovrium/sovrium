/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A text value, trimmed, or `undefined` when it is absent or blank.
 *
 * An operator who writes `KEY=` or `KEY="  "` in a `.env` file means "not
 * set", so every reader that falls back to a default treats a blank value the
 * same as a missing one, and never refuses it as invalid. A forwarding header
 * and a breadcrumb label read the same way.
 */
export const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}
