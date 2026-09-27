/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  flex,
  logo,
  navLink,
  param,
  PLACE_NOTE,
  small,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** One line of footer: mark, four links, copyright. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'footer-simple',
  title: 'Simple footer',
  category: 'marketing',
  tags: ['footer', 'navigation', 'links'],
  description:
    'A one-line page footer: the product mark, four links and the copyright, stacked on a phone.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The four links are written into the fragment; point each at a real page.',
  ],
  params: [
    stringParam('product', 'The product name beside the mark.', '[Product]'),
    stringParam('copyright', 'The copyright line.', '© [Year] [Legal entity]'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      element: 'footer',
      props: { className: 'border-t border-border px-5 py-8 sm:px-8 lg:px-16' },
      children: [
        wrap([
          flex(
            [
              logo(p('product')),
              {
                type: 'container',
                element: 'nav',
                props: { className: 'flex flex-wrap gap-x-6 gap-y-2', 'aria-label': 'Footer' },
                children: [1, 2, 3, 4].map((index) => navLink('[Link]', `/link-${index}`)),
              },
              small(p('copyright')),
            ],
            'flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'
          ),
        ]),
      ],
    })
  },
})
