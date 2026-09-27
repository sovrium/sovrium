/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  body,
  flex,
  grid,
  logo,
  param,
  PLACE_NOTE,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

const COLUMNS = ['Product', 'Resources', 'Company', 'Legal'] as const

const column = (heading: string): BlockNode =>
  stack(
    [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'font-mono text-sm font-normal text-foreground-subtle' },
        content: heading,
      },
      ...[1, 2, 3, 4].map((index) => ({
        type: 'link',
        props: {
          href: `/${heading.toLowerCase()}-${index}`,
          className: 'text-md text-foreground-muted hover:text-foreground',
        },
        content: `[Link ${index}]`,
      })),
    ],
    'gap-3'
  )

/** A full footer: product line, four link columns, then language and theme controls. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'footer-columns',
  title: 'Footer with link columns',
  category: 'marketing',
  tags: ['footer', 'navigation', 'links', 'language', 'theme'],
  description:
    'A page footer: the product name and one line about it, four columns of links, then a hairline over the copyright, a language switcher and a theme toggle.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The column headings and links are written into the fragment; point each link at a real page. Set `languageSwitcher` to `on` once your app declares a `languages` block: the switcher lists those languages, and it needs that block to render.',
    'The link columns sit two by two on a phone and in one row from the large breakpoint up.',
  ],
  params: [
    stringParam('product', 'The product name beside the mark.', '[Product]'),
    stringParam(
      'tagline',
      'One line on what the product is.',
      '[One line on what the product is.]'
    ),
    stringParam('copyright', 'The copyright line.', '© [Year] [Legal entity]'),
    stringParam(
      'languageSwitcher',
      'Set to `on` to show a language switcher — only when your app declares `languages`.',
      'off'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      element: 'footer',
      props: { className: 'border-t border-border px-5 pb-10 pt-14 sm:px-8 lg:px-16 lg:pt-16' },
      children: [
        wrap([
          grid(
            [
              stack(
                [logo(p('product')), body(p('tagline'), 'max-w-xs text-sm sm:text-md')],
                'col-span-2 gap-3 lg:col-span-1'
              ),
              ...COLUMNS.map(column),
            ],
            'grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] lg:gap-8'
          ),
          flex(
            [
              small(p('copyright')),
              flex(
                [
                  ...(p('languageSwitcher') === 'on' ? [{ type: 'language-switcher' }] : []),
                  { type: 'theme-toggle', variant: 'icon', label: 'Switch theme' },
                ],
                'items-center gap-2'
              ),
            ],
            'mt-12 flex-wrap items-center justify-between gap-4 border-t border-border pt-6'
          ),
        ]),
      ],
    })
  },
})
