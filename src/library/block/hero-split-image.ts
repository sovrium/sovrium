/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  actions,
  asComponent,
  eyebrow,
  grid,
  h1,
  lead,
  linkButton,
  media,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A two-column hero: the pitch on the left, a picture on the right. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'hero-split-image',
  title: 'Hero with the pitch beside an image',
  category: 'marketing',
  tags: ['hero', 'landing', 'image', 'call to action'],
  description:
    'An opening section in two columns: label, headline, one sentence and two actions on one side, an image on the other.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Leave `imageSrc` empty to keep a placeholder frame of the same 4:3 ratio until the picture exists. The columns stack on a phone, text first.',
  ],
  params: [
    stringParam('eyebrow', 'A short label above the headline. Empty to omit.', '[Eyebrow]'),
    stringParam(
      'headline',
      'The main heading, rendered as the page h1.',
      'Say what the product does, not what it is'
    ),
    stringParam(
      'subheadline',
      'One or two sentences under the headline.',
      "One or two sentences that answer the visitor's first doubt. Keep the next step obvious."
    ),
    stringParam('ctaLabel', 'The text of the primary call-to-action link.', '[Primary action]'),
    stringParam('ctaHref', 'Where the primary call-to-action link points.', '/contact'),
    stringParam('secondaryLabel', 'The text of the secondary link. Empty to omit.', '[Secondary]'),
    stringParam('secondaryHref', 'Where the secondary link points.', '/about'),
    stringParam('imageSrc', 'Path or URL of the image. Empty keeps the placeholder.', ''),
    stringParam('imageAlt', 'What the image shows, for screen readers.', 'Product in use'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          grid(
            [
              stack(
                [
                  ...when(p('eyebrow'), eyebrow(p('eyebrow'))),
                  h1(p('headline')),
                  lead(p('subheadline')),
                  actions(
                    [
                      linkButton(p('ctaLabel'), p('ctaHref'), 'primary', 'lg'),
                      ...when(
                        p('secondaryLabel'),
                        linkButton(p('secondaryLabel'), p('secondaryHref'), 'ghost', 'lg')
                      ),
                    ],
                    'mt-2'
                  ),
                ],
                'gap-6'
              ),
              media({
                src: p('imageSrc'),
                alt: p('imageAlt'),
                ratio: 'aspect-[4/3]',
                label: 'image · 4:3',
              }),
            ],
            'items-center gap-10 lg:grid-cols-2 lg:gap-16'
          ),
        ]),
      ])
    )
  },
})
