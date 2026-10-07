/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Placeholder plans: replace every bracket before publishing. */
export interface PricingTier {
  readonly name: string
  readonly audience: string
  readonly items: readonly string[]
  readonly highlighted: boolean
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    name: '[Plan A]',
    audience: 'For [who] starting out.',
    items: ['[Included item]', '[Included item]', '[Limit]'],
    highlighted: false,
  },
  {
    name: '[Plan B]',
    audience: 'For [who] who [need].',
    items: ['Everything in [Plan A]', '[Included item]', '[Included item]', '[Limit]'],
    highlighted: true,
  },
  {
    name: '[Plan C]',
    audience: 'For [who] at scale.',
    items: ['Everything in [Plan B]', '[Included item]', '[Named contact]'],
    highlighted: false,
  },
]
