/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  body,
  grid,
  h2,
  h4,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Six questions and answers, all visible, in a grid. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'faq-two-column',
  title: 'FAQ with every answer open',
  category: 'marketing',
  tags: ['faq', 'questions'],
  description:
    'A heading with a link to a person, over six questions whose short answers are all visible at once.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Use this layout when the answers are short enough to read without clicking. One column on a phone, two on a tablet, three from the large breakpoint up.',
  ],
  params: [
    stringParam('headline', 'The section heading.', 'Questions'),
    stringParam('contactLabel', 'The text of the link to a person.', '[Contact a person]'),
    stringParam('contactHref', 'Where that link points.', '/contact'),
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
            [
              h2(p('headline'), 'sm:text-4xl'),
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-lg text-foreground-muted' },
                children: [
                  'Not answered here? ',
                  {
                    type: 'link',
                    props: {
                      href: p('contactHref'),
                      className: 'text-foreground underline underline-offset-4',
                    },
                    content: p('contactLabel'),
                  },
                ],
              },
            ],
            'max-w-xl gap-3'
          ),
          grid(
            [1, 2, 3, 4, 5, 6].map((index) =>
              stack(
                [
                  h4(`[Question ${index}]`),
                  body('[Answer in two sentences at most.]', 'text-sm sm:text-md'),
                ],
                'gap-2'
              )
            ),
            'mt-12 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3'
          ),
        ]),
      ])
    )
  },
})
