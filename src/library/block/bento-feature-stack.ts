/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  body,
  card,
  grid,
  h3,
  h4,
  icon,
  media,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const SUPPORTING = ['zap', 'lock', 'chart-column'] as const

/** One large tile beside a stack of three smaller ones. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'bento-feature-stack',
  title: 'Bento: one large tile beside a stack',
  category: 'marketing',
  tags: ['features', 'bento', 'grid', 'proof'],
  description:
    'A composed grid of unequal weight: one headline proof with a visual on the left, three supporting proofs stacked on the right.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Built from two columns — a card beside a column of three cards — so no tile needs to span cells. The columns stack on a phone.',
    'Leave `imageSrc` empty to keep the placeholder visual.',
  ],
  params: [
    stringParam('eyebrow', 'A short label above the heading. Empty to omit.', '[Eyebrow]'),
    stringParam('headline', 'The section heading.', 'One headline proof, three supporting ones'),
    stringParam('mainTitle', 'The title of the large tile.', '[Headline proof]'),
    stringParam(
      'mainText',
      'The text of the large tile.',
      'Two sentences that explain what the visual shows.'
    ),
    stringParam(
      'imageSrc',
      'Path or URL of the large tile visual. Empty keeps the placeholder.',
      ''
    ),
    stringParam(
      'imageAlt',
      'What the visual shows, for screen readers.',
      'Visual for the headline proof'
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
          sectionHead({ eyebrow: p('eyebrow'), title: p('headline') }),
          grid(
            [
              card(
                [
                  media({
                    src: p('imageSrc'),
                    alt: p('imageAlt'),
                    ratio: 'aspect-[4/3]',
                    label: 'visual',
                  }),
                  h3(p('mainTitle'), 'mt-2'),
                  body(p('mainText')),
                ],
                'flex flex-col gap-4 p-6 sm:p-8'
              ),
              stack(
                SUPPORTING.map((name) =>
                  card(
                    [
                      icon(name, 'flex-none text-foreground', 22),
                      stack(
                        [
                          h4('[Supporting proof]'),
                          body('One sentence, specific to the reader.', 'text-sm sm:text-md'),
                        ],
                        'gap-1'
                      ),
                    ],
                    'flex flex-1 items-start gap-4 p-6 sm:p-8'
                  )
                ),
                'gap-4'
              ),
            ],
            'mt-12 gap-4 lg:grid-cols-2'
          ),
        ]),
      ])
    )
  },
})
