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
import type { BlockNode } from '@/library/manifest/block-kit'

const cards = (period: string, price: string, href: string): BlockNode =>
  grid(
    PRICING_TIERS.map((tier) => pricingCard({ tier, period, price, href })),
    'mt-8 items-stretch gap-4 lg:grid-cols-3'
  )

/** Three plans with a Monthly / Yearly switch above them. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pricing-toggle',
  title: 'Pricing with a monthly and yearly switch',
  category: 'marketing',
  tags: ['pricing', 'plans', 'tiers', 'billing period', 'tabs'],
  description:
    'Three plan cards under a two-tab switch — one tab per billing period, each holding its own set of cards and prices.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The switch is a `tabs` component with one panel per period, so each panel carries its own copy of the three cards: change a plan in both panels. The switch is keyboard-operable (arrow keys move between the two tabs).',
    'Prices are placeholders written into the fragment; replace every `[PRICE]` before publishing.',
  ],
  params: [
    stringParam('headline', 'The section heading.', '[Pricing heading]'),
    stringParam(
      'subheadline',
      'One sentence under the heading.',
      'One sentence on what every plan includes.'
    ),
    stringParam('monthlyLabel', 'The label of the first tab.', 'Monthly'),
    stringParam('yearlyLabel', 'The label of the second tab.', 'Yearly · [−00 %]'),
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
          {
            type: 'tabs',
            layout: 'flow',
            defaultTab: 'monthly',
            props: { className: 'mt-10' },
            panels: [
              { id: 'monthly', label: p('monthlyLabel') },
              { id: 'yearly', label: p('yearlyLabel') },
            ],
            children: [
              cards('month', '[PRICE]', p('ctaHref')),
              cards('year', '[PRICE]', p('ctaHref')),
            ],
          },
          ...when(p('footnote'), stack([small(p('footnote'))], 'mt-6 items-center text-center')),
        ]),
      ])
    )
  },
})
