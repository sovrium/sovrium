/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  grid,
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

/** Three figures computed live from one of your tables. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'stats-from-table',
  title: 'Live figures from a table',
  category: 'marketing',
  tags: ['stats', 'figures', 'kpi', 'numbers', 'data'],
  description:
    'A section of three figures computed from one of your tables at render time — a count, a total and an average — so nothing on the page is typed twice.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The figures are aggregated from every record of the table the viewer may read. Add a `dataSource.filter` to each card to narrow them.',
    THEME_NOTE,
  ],
  params: [
    stringParam(
      'headline',
      'The heading above the figures. Empty to omit.',
      '[What these numbers prove]'
    ),
    stringParam('table', 'The table the figures are computed from.', 'orders'),
    stringParam('amountField', 'The number field the total and the average read.', 'amount'),
    stringParam('countLabel', 'The label of the record count.', 'Records'),
    stringParam('sumLabel', 'The label of the total.', 'Total'),
    stringParam('avgLabel', 'The label of the average.', 'Average'),
  ],
  tables: [{ param: 'table', fields: [{ name: 'amount', param: 'amountField', type: 'decimal' }] }],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const kpi = (
      label: string,
      aggregate: Readonly<Record<string, string>>
    ): Readonly<Record<string, unknown>> => ({
      type: 'kpi',
      label,
      dataSource: { table: p('table') },
      kpiAggregate: aggregate,
      kpiFormat: { type: 'number' },
    })
    return asComponent(
      name,
      section([
        wrap([
          stack(
            [
              ...(p('headline') === '' ? [] : [sectionHead({ title: p('headline') })]),
              grid(
                [
                  kpi(p('countLabel'), { function: 'count' }),
                  kpi(p('sumLabel'), { function: 'sum', field: p('amountField') }),
                  kpi(p('avgLabel'), { function: 'avg', field: p('amountField') }),
                ],
                'gap-4 sm:grid-cols-3 sm:gap-6'
              ),
            ],
            'gap-10'
          ),
        ]),
      ])
    )
  },
})
