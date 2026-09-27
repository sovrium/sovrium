/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  h2,
  param,
  PLACE_NOTE,
  section,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A static table comparing three plans feature by feature. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pricing-comparison',
  title: 'Pricing comparison table',
  category: 'marketing',
  tags: ['pricing', 'plans', 'comparison', 'table'],
  description:
    'A plain table comparing three plans row by row — what each includes, its limits, its support and its price.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The rows are written into the fragment as `tableHeaders` and `tableRows`. Cells are text: write “Included” and “—” rather than icons. The table scrolls sideways on a phone rather than squeezing its columns.',
  ],
  params: [stringParam('headline', 'The section heading.', 'Compare plans')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          h2(p('headline'), 'sm:text-4xl'),
          {
            type: 'container',
            props: {
              className:
                'mt-8 overflow-x-auto rounded-lg border border-border bg-background-raised',
            },
            children: [
              {
                type: 'table',
                tableHeaders: ['Feature', '[Plan A]', '[Plan B]', '[Plan C]'],
                tableRows: [
                  ['[Feature one]', 'Included', 'Included', 'Included'],
                  ['[Feature two]', '—', 'Included', 'Included'],
                  ['[Limit]', '[n]', '[n]', 'Unlimited'],
                  ['[Feature four]', '—', '—', 'Included'],
                  ['[Support]', 'Email', 'Email', '[Named contact]'],
                  ['Price', '[PRICE]', '[PRICE]', '[PRICE]'],
                ],
                props: {
                  className:
                    '!table !w-full !rounded-none !border-0 !bg-transparent min-w-[36rem] text-left text-md text-foreground [&_th]:border-b [&_th]:border-border [&_th]:px-4 [&_th]:py-3 [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground-subtle [&_td]:border-b [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_tr:last-child_td]:border-b-0 [&_td:first-child]:font-medium',
                },
              },
            ],
          },
        ]),
      ])
    )
  },
})
