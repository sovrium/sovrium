/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  actions,
  asComponent,
  grid,
  h2,
  lead,
  linkButton,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The closing call to action: heading on the left, actions on the right, over a hairline. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'cta-split',
  title: 'Call to action, split on a hairline',
  category: 'marketing',
  tags: ['call to action', 'cta', 'closing'],
  description:
    'Repeats the page’s one primary action once the argument is made: a heading and one sentence beside two actions, under a thin rule.',
  notes: [PLACE_NOTE, THEME_NOTE, 'The two columns stack on a phone, with the actions full width.'],
  params: [
    stringParam('headline', 'The heading.', 'Ready when you are'),
    stringParam(
      'subheadline',
      'One sentence under the heading.',
      'A sentence that says exactly what happens after the click.'
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
          grid(
            [
              stack(
                [h2(p('headline')), ...when(p('subheadline'), lead(p('subheadline')))],
                'gap-3'
              ),
              actions(
                [
                  ...when(
                    p('secondaryLabel'),
                    linkButton(p('secondaryLabel'), p('secondaryHref'), 'secondary', 'lg')
                  ),
                  linkButton(p('ctaLabel'), p('ctaHref'), 'primary', 'lg'),
                ],
                'lg:justify-end'
              ),
            ],
            'items-end gap-8 border-t border-border pt-12 lg:grid-cols-2 lg:pt-14'
          ),
        ]),
      ])
    )
  },
})
