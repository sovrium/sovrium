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
  panel,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { inWindow, PERIOD_NOTE, periodSelector } from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Four figures from one table, each with the movement it declares. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'kpi-row-trend',
  title: 'Row of figures with a trend',
  category: 'application',
  tags: ['kpi', 'stats', 'dashboard', 'trend', 'metrics'],
  description:
    'A row of four figures an operator checks first — a count, a total, an average and a maximum — computed from one of your tables, narrowed by the page’s period selector.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    PERIOD_NOTE,
    'No trend is drawn: a comparison with the previous period is not measured yet, and a placeholder arrow would claim a movement nobody measured.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the figures are computed from.', 'invoices'),
    stringParam('amountField', 'The number field the total, average and maximum read.', 'amount'),
    stringParam('dateField', 'The date field the period filters on.', 'issued_on'),
    stringParam('currency', 'The ISO currency code the amounts are formatted in.', 'EUR'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'amount', param: 'amountField', type: 'decimal' },
        { name: 'issued_on', param: 'dateField', type: 'date' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const money = { type: 'currency', options: { currency: p('currency') } }
    const kpi = (
      label: string,
      aggregate: Readonly<Record<string, string>>,
      format: Readonly<Record<string, unknown>>
    ): Readonly<Record<string, unknown>> => ({
      type: 'kpi',
      label,
      dataSource: inWindow(p('table'), p('dateField')),
      kpiAggregate: aggregate,
      kpiFormat: format,
    })
    return asComponent(
      name,
      panel([
        periodSelector(),
        grid(
          [
            kpi('[Records]', { function: 'count' }, { type: 'number' }),
            kpi('[Total]', { function: 'sum', field: p('amountField') }, money),
            kpi('[Average]', { function: 'avg', field: p('amountField') }, money),
            kpi('[Largest]', { function: 'max', field: p('amountField') }, money),
          ],
          'mt-4 gap-4 sm:grid-cols-2 lg:grid-cols-4'
        ),
      ])
    )
  },
})
