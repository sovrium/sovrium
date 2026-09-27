/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  grid,
  param,
  PLACE_NOTE,
  PRICING_TIERS,
  pricingCard,
  section,
  sectionHead,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Three plans side by side, the middle one marked as the most chosen. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pricing-three-tier',
  title: 'Pricing in three tiers',
  category: 'marketing',
  tags: ['pricing', 'plans', 'tiers'],
  description:
    'Three plan cards side by side — name, audience, price, action and what each includes — with the middle plan marked as the most chosen.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Prices and inclusions are placeholders written into the fragment; replace every `[PRICE]` before publishing. The cards stack on a phone.',
  ],
  params: [
    stringParam('headline', 'The section heading.', '[Pricing heading]'),
    stringParam(
      'subheadline',
      'One sentence under the heading.',
      'One sentence on what every plan includes.'
    ),
    stringParam('period', 'The billing period shown after each price.', '[period]'),
    stringParam('ctaHref', 'Where each plan’s action points.', '/contact'),
    stringParam(
      'footnote',
      'A small line under the cards. Empty to omit.',
      '[Tax and billing note]'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          sectionHead({ title: p('headline'), lead: p('subheadline') }, 'center'),
          grid(
            PRICING_TIERS.map((tier) =>
              pricingCard({ tier, period: p('period'), price: '[PRICE]', href: p('ctaHref') })
            ),
            'mt-12 items-stretch gap-4 lg:grid-cols-3'
          ),
          ...when(p('footnote'), stack([small(p('footnote'))], 'mt-6 items-center text-center')),
        ]),
      ])
    )
  },
})
