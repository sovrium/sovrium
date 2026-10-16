/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DesignElevation } from '@/domain/models/app/design/elevation'

/** A shadow that draws nothing yet stays a valid member of a shadow list. */
const TRANSPARENT_SHADOW = '0 0 #0000'

/**
 * The `design.elevation` steps as `@theme` values, a step written `none`
 * becoming a transparent zero-size shadow.
 *
 * Tailwind composes every shadow utility with the ring layers into ONE
 * `box-shadow` list, and a `none` inside that list makes the whole declaration
 * invalid: on a flat design (`sm: none`) a `shadow-sm` control lost its focus
 * ring along with its shadow (WCAG 2.4.7). Every other value is kept as written.
 */
export function withoutNoneShadows(
  shadows: DesignElevation | undefined
): Readonly<Record<string, string>> | undefined {
  if (shadows === undefined) return undefined
  return Object.fromEntries(
    Object.entries(shadows as Record<string, string>).map(([key, value]) => [
      key,
      value.trim().toLowerCase() === 'none' ? TRANSPARENT_SHADOW : value,
    ])
  )
}
