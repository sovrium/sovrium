/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface FormAvailabilityShape {
  readonly opensAt?: string
  readonly closesAt?: string
  readonly maxSubmissions?: number
}

export type AvailabilityWindowState =
  | { readonly kind: 'open' }
  | { readonly kind: 'not-yet-open'; readonly opensAt: string }
  | { readonly kind: 'closed'; readonly closedAt: string }

export const evaluateAvailabilityWindow = (
  availability: FormAvailabilityShape | undefined,
  now: number
): AvailabilityWindowState => {
  if (availability === undefined) return { kind: 'open' }
  const { opensAt, closesAt } = availability
  if (opensAt !== undefined) {
    const open = Date.parse(opensAt)
    if (!Number.isNaN(open) && now < open) {
      return { kind: 'not-yet-open', opensAt }
    }
  }
  if (closesAt !== undefined) {
    const close = Date.parse(closesAt)
    if (!Number.isNaN(close) && now >= close) {
      return { kind: 'closed', closedAt: closesAt }
    }
  }
  return { kind: 'open' }
}
