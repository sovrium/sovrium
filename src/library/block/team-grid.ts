/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  grid,
  media,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const member = (index: number): Readonly<Record<string, unknown>> =>
  stack(
    [
      media({
        src: '',
        alt: `Portrait of team member ${index}`,
        ratio: 'aspect-square',
        label: 'portrait',
      }),
      {
        type: 'text',
        element: 'p',
        props: { className: 'mt-2 text-md font-semibold text-foreground' },
        content: '[Full name]',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-sm text-foreground-subtle' },
        content: '[Role]',
      },
    ],
    'gap-1'
  )

/** A heading over eight portraits with name and role. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'team-grid',
  title: 'Team portrait grid',
  category: 'marketing',
  tags: ['team', 'people', 'about'],
  description:
    'A heading and one sentence over eight square portraits, each with a name and a role.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Each portrait starts as a square placeholder frame. Replace it in the fragment with an `image` component once the photo exists; add or remove members by copying one.',
    'Two portraits per row on a phone, four from the large breakpoint up.',
  ],
  params: [
    stringParam('headline', 'The section heading.', '[Who we are]'),
    stringParam(
      'subheadline',
      'One sentence under the heading. Empty to omit.',
      'One sentence on how the team works with clients.'
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
          sectionHead({ title: p('headline'), lead: p('subheadline') }),
          grid(
            [1, 2, 3, 4, 5, 6, 7, 8].map(member),
            'mt-12 grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4'
          ),
        ]),
      ])
    )
  },
})
