/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  flex,
  param,
  PLACE_NOTE,
  small,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const slot = (index: number): Readonly<Record<string, unknown>> => ({
  type: 'container',
  props: {
    className:
      'flex h-10 min-w-32 items-center justify-center rounded-md border border-border bg-background-inset px-4',
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'font-mono text-sm text-foreground-subtle' },
      content: `logo ${index}`,
    },
  ],
})

/** A slim band of logos that scrolls sideways. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'logos-marquee',
  title: 'Scrolling logo strip',
  category: 'marketing',
  tags: ['logos', 'customers', 'social proof', 'marquee'],
  description:
    'A slim band between two hairlines: a short label, then a strip of logos scrolling sideways with faded edges.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The strip is a `marquee`: it pauses while hovered or focused and carries its own pause button, so the motion can always be stopped. Publish a logo only with the organisation’s permission.',
    'Each slot is a placeholder; replace it in the fragment with an `image` of the logo.',
  ],
  params: [stringParam('intro', 'The label before the strip.', '[Used by]')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      element: 'section',
      props: { className: 'border-y border-border px-5 py-6 sm:px-8 lg:px-16' },
      children: [
        flex(
          [
            small(p('intro'), 'flex-none whitespace-nowrap text-md text-foreground-muted'),
            {
              type: 'container',
              props: { className: 'min-w-0 flex-1' },
              children: [
                {
                  type: 'marquee',
                  marqueeDirection: 'left',
                  marqueeSpeed: 40,
                  marqueeGap: '1rem',
                  pauseOnHover: true,
                  marqueeFade: true,
                  pauseControl: true,
                  children: [1, 2, 3, 4, 5, 6, 7, 8].map(slot),
                },
              ],
            },
          ],
          'flex-col gap-4 sm:flex-row sm:items-center sm:gap-8'
        ),
      ],
    })
  },
})
