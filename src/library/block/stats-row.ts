/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  body,
  figure,
  flex,
  grid,
  h2,
  param,
  PLACE_NOTE,
  section,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const FIGURES = ['[00]', '[00 %]', '[0.0×]', '[000]'] as const

/** Four static figures in a row, with the source they come from. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'stats-row',
  title: 'Row of static figures',
  category: 'marketing',
  tags: ['stats', 'figures', 'numbers', 'proof'],
  description:
    'A heading and its source line over four figures, each set large in the monospace face with a line on what it measures.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The figures are text written into the fragment, not live values: every one is a placeholder, and none should ship without the source named in `source`. For a figure read from a table, use a `kpi` component instead.',
    'Two figures per row on a phone, four from the large breakpoint up.',
  ],
  params: [
    stringParam('headline', 'The section heading.', '[What these numbers prove]'),
    stringParam(
      'source',
      'Where the figures come from, and when. Empty to omit.',
      '[Source · date]'
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
          flex(
            [h2(p('headline'), 'sm:text-4xl'), ...when(p('source'), small(p('source')))],
            'flex-wrap items-end justify-between gap-4'
          ),
          grid(
            FIGURES.map((value, index) =>
              stack(
                [figure(value), body(`[What figure ${index + 1} measures]`, 'text-sm sm:text-md')],
                'gap-2'
              )
            ),
            'mt-12 grid-cols-2 gap-x-6 gap-y-10 border-t border-border pt-8 lg:grid-cols-4'
          ),
        ]),
      ])
    )
  },
})
