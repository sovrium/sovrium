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
  h4,
  iconTile,
  linkButton,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const ITEMS: ReadonlyArray<readonly [string, string, string]> = [
  ['zap', 'Starts in minutes', 'One line on what the reader does, one on what they get.'],
  ['lock', 'Access by role', 'Name the role and the rule, not the security jargon.'],
  ['chart-column', 'Numbers on one page', 'Say which numbers, and who reads them.'],
  ['upload', 'Leave with everything', 'Export format and effort, stated plainly.'],
]

/** A heading and an action on one side, four icon rows on the other. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'feature-list-icons',
  title: 'Heading beside an icon list',
  category: 'marketing',
  tags: ['features', 'benefits', 'list', 'icons'],
  description:
    'Two columns: the argument and one action on the left, four icon rows on the right that prove it.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The four rows are written into the fragment; edit their icon, title and text there. The columns stack on a phone.',
  ],
  params: [
    stringParam('eyebrow', 'A short label above the heading. Empty to omit.', '[Eyebrow]'),
    stringParam('headline', 'The section heading.', 'A heading that the four items prove'),
    stringParam(
      'subheadline',
      'One sentence under the heading. Empty to omit.',
      'Keep the argument on the left and the evidence on the right.'
    ),
    stringParam('ctaLabel', 'The text of the action link. Empty to omit.', '[Primary action]'),
    stringParam('ctaHref', 'Where the action link points.', '/contact'),
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
                  sectionHead({
                    eyebrow: p('eyebrow'),
                    title: p('headline'),
                    lead: p('subheadline'),
                  }),
                  ...when(
                    p('ctaLabel'),
                    flex([linkButton(p('ctaLabel'), p('ctaHref'), 'secondary')], 'mt-4')
                  ),
                ],
                'gap-4'
              ),
              stack(
                ITEMS.map(([icon, title, text]) =>
                  flex(
                    [iconTile(icon), stack([h4(title), body(text, 'text-sm sm:text-md')], 'gap-1')],
                    'items-start gap-4 border-b border-border py-5 last:border-b-0'
                  )
                ),
                'gap-0'
              ),
            ],
            'gap-12 lg:grid-cols-2 lg:gap-20'
          ),
        ]),
      ])
    )
  },
})
