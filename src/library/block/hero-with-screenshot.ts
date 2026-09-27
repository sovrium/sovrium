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

/** A centred hero followed by a wide product screenshot. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'hero-with-screenshot',
  title: 'Hero with a product screenshot',
  category: 'marketing',
  tags: ['hero', 'landing', 'screenshot', 'product'],
  description:
    'A centred opening section whose headline points at a wide screenshot of the product underneath it.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Leave `imageSrc` empty to keep a 16:9 placeholder frame. The screenshot is the proof; keep the copy short.',
  ],
  params: [
    stringParam('eyebrow', 'A short label above the headline. Empty to omit.', '[Eyebrow]'),
    stringParam(
      'headline',
      'The main heading, rendered as the page h1.',
      'Show the product doing the job the headline promises'
    ),
    stringParam(
      'subheadline',
      'One sentence under the headline.',
      'The screenshot is the proof. The copy only has to point at it.'
    ),
    stringParam('ctaLabel', 'The text of the primary call-to-action link.', '[Primary action]'),
    stringParam('ctaHref', 'Where the primary call-to-action link points.', '/contact'),
    stringParam('secondaryLabel', 'The text of the secondary link. Empty to omit.', '[Secondary]'),
    stringParam('secondaryHref', 'Where the secondary link points.', '/about'),
    stringParam('imageSrc', 'Path or URL of the screenshot. Empty keeps the placeholder.', ''),
    stringParam(
      'imageAlt',
      'What the screenshot shows, for screen readers.',
      'The product dashboard'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section(
        [
          wrap([
            stack(
              [
                ...when(p('eyebrow'), eyebrow(p('eyebrow'))),
                h1(p('headline'), 'max-w-4xl'),
                lead(p('subheadline'), 'max-w-2xl'),
                actions(
                  [
                    linkButton(p('ctaLabel'), p('ctaHref'), 'primary', 'lg'),
                    ...when(
                      p('secondaryLabel'),
                      linkButton(p('secondaryLabel'), p('secondaryHref'), 'secondary', 'lg')
                    ),
                  ],
                  'w-full sm:w-auto sm:justify-center'
                ),
                {
                  type: 'container',
                  props: {
                    className:
                      'mt-10 w-full rounded-t-xl border border-b-0 border-border bg-background-raised p-2',
                  },
                  children: [
                    media({
                      src: p('imageSrc'),
                      alt: p('imageAlt'),
                      ratio: 'aspect-video',
                      label: 'product screenshot · 16:9',
                      className: 'rounded-b-none',
                    }),
                  ],
                },
              ],
              'items-center gap-6 text-center'
            ),
          ]),
        ],
        { className: 'pb-0!' }
      )
    )
  },
})
