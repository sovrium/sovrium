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
  h1,
  lead,
  param,
  PLACE_NOTE,
  section,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

const partHeading = (content: string): BlockNode => ({
  type: 'text',
  element: 'h2',
  props: { className: 'mt-4 text-2xl font-semibold tracking-tight text-foreground' },
  content,
})

/** A guide with a sticky table of contents built from its own headings. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'content-with-toc',
  title: 'Guide with a table of contents',
  category: 'marketing',
  tags: ['content', 'guide', 'documentation', 'table of contents'],
  description:
    'A guide in one column beside a table of contents that is built from the page’s headings, stays in view while scrolling and marks the section being read.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The table of contents is a `toc` component: it reads the headings on the page, so it needs no list of its own. It is hidden below the large breakpoint, where the guide takes the full width.',
    'The guide is written into the fragment as `text` and `code` components; edit, add or remove parts there.',
  ],
  params: [
    stringParam('headline', 'The guide title, rendered as the page h1.', '[Guide title]'),
    stringParam(
      'standfirst',
      'What the reader can do by the end.',
      '[What the reader can do by the end.]'
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
          grid(
            [
              {
                type: 'container',
                element: 'aside',
                props: { className: 'hidden lg:block' },
                children: [
                  {
                    type: 'toc',
                    props: { sticky: true, className: 'lg:top-8 text-sm' },
                  },
                ],
              },
              {
                type: 'container',
                element: 'article',
                props: { className: 'flex min-w-0 max-w-2xl flex-col gap-6' },
                children: [
                  h1(p('headline'), 'lg:text-5xl'),
                  lead(p('standfirst')),
                  partHeading('[First part]'),
                  body('[Paragraph.]', 'text-lg'),
                  {
                    type: 'code',
                    props: { language: 'yaml' },
                    filename: 'app.yaml',
                    content:
                      'pages:\n  - path: /\n    components:\n      - component: hero-centered',
                  },
                  partHeading('[Second part]'),
                  body('[Paragraph.]', 'text-lg'),
                  partHeading('[Third part]'),
                  body('[Paragraph.]', 'text-lg'),
                ],
              },
            ],
            'gap-16 lg:grid-cols-[13rem_minmax(0,1fr)]'
          ),
        ]),
      ])
    )
  },
})
