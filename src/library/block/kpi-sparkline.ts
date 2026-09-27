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

/** Three figures from one table, each with a sparkline of its recent weeks. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'kpi-sparkline',
  title: 'Figures with a sparkline',
  category: 'application',
  tags: ['kpi', 'stats', 'dashboard', 'sparkline', 'chart', 'metrics'],
  description:
    'Three figures computed from one of your tables, each drawn with a small line of its last ninety days grouped by week.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'Each sparkline groups the records by the date field, one point per week over the last ninety days. Records with no date are left out of the line but still counted in the figure.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the figures are computed from.', 'invoices'),
    stringParam('amountField', 'The number field the figures and lines read.', 'amount'),
    stringParam('dateField', 'The date field the lines are grouped by.', 'issued_on'),
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
    const sparkline = {
      field: p('amountField'),
      groupBy: p('dateField'),
      interval: 'week',
      days: 90,
    }
    const kpi = (
      label: string,
      aggregate: Readonly<Record<string, string>>
    ): Readonly<Record<string, unknown>> => ({
      type: 'kpi',
      label,
      dataSource: { table: p('table') },
      kpiAggregate: aggregate,
      kpiFormat: { type: 'compact' },
      sparkline,
    })
    return asComponent(
      name,
      panel([
        grid(
          [
            kpi('[Records]', { function: 'count' }),
            kpi('[Total]', { function: 'sum', field: p('amountField') }),
            kpi('[Average]', { function: 'avg', field: p('amountField') }),
          ],
          'gap-4 md:grid-cols-3'
        ),
      ])
    )
  },
})
