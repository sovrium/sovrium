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
import { defineLibraryEntry } from '@/library/manifest/define'

/** Four figures from one table, each with the movement it declares. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'kpi-row-trend',
  title: 'Row of figures with a trend',
  category: 'application',
  tags: ['kpi', 'stats', 'dashboard', 'trend', 'metrics'],
  description:
    'A row of four figures an operator checks first — a count, a total, an average and a maximum — computed from one of your tables, each with a trend line.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The trend under each figure is DECLARED, not computed: it ships as a flat 0 % placeholder. Set each card’s `trend` to the movement you measured, or delete it. Its colour is independent of its direction on purpose — a rising cost is red, a rising revenue is not.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the figures are computed from.', 'invoices'),
    stringParam('amountField', 'The number field the total, average and maximum read.', 'amount'),
    stringParam('currency', 'The ISO currency code the amounts are formatted in.', 'EUR'),
  ],
  tables: [{ param: 'table', fields: [{ name: 'amount', param: 'amountField', type: 'decimal' }] }],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const money = { type: 'currency', options: { currency: p('currency') } }
    const trend = {
      comparisonPeriod: 'previousMonth',
      direction: 'flat',
      changePercent: 0,
      color: 'gray',
    }
    const kpi = (
      label: string,
      aggregate: Readonly<Record<string, string>>,
      format: Readonly<Record<string, unknown>>
    ): Readonly<Record<string, unknown>> => ({
      type: 'kpi',
      label,
      dataSource: { table: p('table') },
      kpiAggregate: aggregate,
      kpiFormat: format,
      trend,
    })
    return asComponent(
      name,
      panel([
        grid(
          [
            kpi('[Records]', { function: 'count' }, { type: 'number' }),
            kpi('[Total]', { function: 'sum', field: p('amountField') }, money),
            kpi('[Average]', { function: 'avg', field: p('amountField') }, money),
            kpi('[Largest]', { function: 'max', field: p('amountField') }, money),
          ],
          'gap-4 sm:grid-cols-2 lg:grid-cols-4'
        ),
      ])
    )
  },
})
