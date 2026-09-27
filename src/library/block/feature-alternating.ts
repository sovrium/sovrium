/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  arrowLink,
  asComponent,
  body,
  eyebrow,
  grid,
  h2,
  media,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

const ROWS = [
  {
    label: '[01]',
    title: 'First benefit, stated as an outcome',
    text: 'Two or three sentences that show how it works in practice, with one concrete example.',
  },
  {
    label: '[02]',
    title: 'Second benefit, stated as an outcome',
    text: 'Same rhythm as the first. The image changes sides, the copy keeps its length.',
  },
] as const

const row = (
  item: (typeof ROWS)[number],
  index: number,
  linkLabel: string,
  linkHref: string
): BlockNode => {
  const flipped = index % 2 === 1
  return grid(
    [
      stack(
        [
          eyebrow(item.label),
          h2(item.title, 'sm:text-4xl'),
          body(item.text),
          {
            type: 'container',
            props: { className: 'mt-2' },
            children: [arrowLink(linkLabel, linkHref)],
          },
        ],
        `gap-4 ${flipped ? 'lg:order-2' : ''}`.trim()
      ),
      media({
        src: '',
        alt: item.title,
        ratio: 'aspect-[4/3]',
        label: 'image · 4:3',
        className: flipped ? 'lg:order-1' : '',
      }),
    ],
    'items-center gap-10 lg:grid-cols-2 lg:gap-16'
  )
}

/** Two benefit rows, the image switching sides on wide screens. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'feature-alternating',
  title: 'Alternating image and text',
  category: 'marketing',
  tags: ['features', 'benefits', 'image', 'zigzag'],
  description:
    'Two rows, each a benefit beside an image; the second row puts its image first on wide screens so the eye zigzags down the page.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'On a phone every row stacks text first, image second — the side swap applies from the large breakpoint up, through responsive order classes.',
    'The images start as 4:3 placeholder frames. Replace each placeholder in the fragment with an `image` component once the picture exists; add rows by copying one.',
  ],
  params: [
    stringParam('linkLabel', 'The text of the link under each row.', '[Learn how]'),
    stringParam('linkHref', 'Where the row links point.', '/features'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          stack(
            ROWS.map((item, index) => row(item, index, p('linkLabel'), p('linkHref'))),
            'gap-20 lg:gap-24'
          ),
        ]),
      ])
    )
  },
})
