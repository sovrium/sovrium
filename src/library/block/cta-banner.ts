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
  section,
  stack,
  stringParam,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

const INVERSE_BUTTON =
  'inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md border px-5 text-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-fg)]'

const bannerActions = (p: (key: string) => string): BlockNode =>
  flex(
    [
      {
        type: 'link',
        props: {
          href: p('ctaHref'),
          className: `${INVERSE_BUTTON} border-primary-fg bg-primary-fg text-primary hover:opacity-90`,
        },
        content: p('ctaLabel'),
      },
      ...when(p('secondaryLabel'), {
        type: 'link',
        props: {
          href: p('secondaryHref'),
          className: `${INVERSE_BUTTON} border-[color-mix(in_oklch,var(--color-primary-fg)_40%,transparent)] text-primary-fg hover:bg-[color-mix(in_oklch,var(--color-primary-fg)_10%,transparent)]`,
        },
        content: p('secondaryLabel'),
      }),
    ],
    'flex-col gap-3 sm:flex-row'
  )

/** A call to action on a filled band in the primary colour. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'cta-banner',
  title: 'Call to action on an inverted banner',
  category: 'marketing',
  tags: ['call to action', 'cta', 'banner', 'closing'],
  description:
    'A filled band in the primary colour carrying the closing invitation: a heading, one sentence and two actions.',
  notes: [
    PLACE_NOTE,
    'The band is painted with `--color-primary` and its text with `--color-primary-fg`, so it inverts whatever primary colour your `theme` declares — dark on a light theme, light on a dark one.',
    'The inverted fill is a class recipe on a `card`, not a card option: edit the classes in the fragment to change it.',
  ],
  params: [
    stringParam('headline', 'The heading.', 'Repeat the offer as an invitation'),
    stringParam(
      'subheadline',
      'One sentence under the heading.',
      'One sentence that removes the last doubt.'
    ),
    stringParam('ctaLabel', 'The text of the primary action.', '[Primary action]'),
    stringParam('ctaHref', 'Where the primary action points.', '/contact'),
    stringParam(
      'secondaryLabel',
      'The text of the secondary action. Empty to omit.',
      '[Secondary]'
    ),
    stringParam('secondaryHref', 'Where the secondary action points.', '/about'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          {
            type: 'card',
            props: {
              className:
                'flex flex-col gap-8 rounded-xl border-primary bg-primary p-8 text-primary-fg shadow-none sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:p-14',
            },
            children: [
              stack(
                [
                  {
                    type: 'text',
                    element: 'h2',
                    props: {
                      className:
                        'text-3xl font-semibold tracking-tight text-balance text-primary-fg sm:text-4xl',
                    },
                    content: p('headline'),
                  },
                  ...when(p('subheadline'), {
                    type: 'text',
                    element: 'p',
                    props: { className: 'text-lg text-primary-fg opacity-75' },
                    content: p('subheadline'),
                  }),
                ],
                'max-w-xl gap-3'
              ),
              bannerActions(p),
            ],
          },
        ]),
      ])
    )
  },
})
