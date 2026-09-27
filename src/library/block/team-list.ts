/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  flex,
  grid,
  param,
  person,
  PLACE_NOTE,
  section,
  sectionHead,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const row = (index: number): Readonly<Record<string, unknown>> =>
  flex(
    [
      person('[Full name]', '[Role]'),
      {
        type: 'link',
        props: {
          href: `#member-${index}`,
          'aria-label': `Profile of team member ${index}`,
          className:
            'inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle hover:bg-background-subtle hover:text-foreground',
        },
        children: [{ type: 'icon', props: { name: 'link', size: 18 } }],
      },
    ],
    'items-center justify-between gap-4 border-b border-border py-4 last:border-b-0'
  )

/** A heading beside a list of five people with a link each. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'team-list',
  title: 'Team list beside a heading',
  category: 'marketing',
  tags: ['team', 'people', 'about', 'list'],
  description:
    'Two columns: a heading and one sentence on the left, five people on the right — initials, name, role and a profile link.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The people are placeholders written into the fragment; point each profile link at a real page or remove it. The columns stack on a phone.',
  ],
  params: [
    stringParam('headline', 'The section heading.', '[Who you will work with]'),
    stringParam(
      'subheadline',
      'One sentence under the heading. Empty to omit.',
      'The people a client actually talks to.'
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
              sectionHead({ title: p('headline'), lead: p('subheadline') }),
              stack([1, 2, 3, 4, 5].map(row), 'gap-0'),
            ],
            'gap-12 lg:grid-cols-2 lg:gap-20'
          ),
        ]),
      ])
    )
  },
})
