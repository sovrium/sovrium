/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Every morning, the Pennylane customer invoices not seen before become rows
 * of one of the operator's tables — the same shape as the Qonto recipe:
 * paginated read, `filterNew` on the invoice id, one row per new invoice.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'pennylane-invoices-to-table',
  title: 'File new Pennylane customer invoices into a table every morning',
  category: 'finance',
  tags: ['pennylane', 'invoices', 'accounting', 'cron', 'sync'],
  description:
    'A scheduled automation that reads your Pennylane customer invoices and adds each one not seen before as a row of your table.',
  notes: [
    'The automation runs on the schedule `schedule` (07:30 every day by default), reads every page of customer invoices through the `get-customer-invoices` operation of the `pennylane` connection, keeps the ones it has not filed before, and creates one row per invoice in the table named by `table`.',
    'Its first run files nothing, so switching it on does not replay every invoice already issued. Point it at your own table with `--set table=<your table>`; the table needs the fields listed below.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table each new invoice is added to.',
      type: 'string',
      default: 'customer_invoices',
    },
    {
      name: 'schedule',
      description: 'When to run, as a cron expression.',
      type: 'string',
      default: '30 7 * * *',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'pennylane_id', type: 'single-line-text' },
        { name: 'invoice_number', type: 'single-line-text' },
        { name: 'amount', type: 'decimal' },
        { name: 'invoice_date', type: 'date' },
        { name: 'status', type: 'single-line-text' },
      ],
    },
  ],
  env: [],
  requires: ['connection/pennylane'],
  provider: {
    name: 'Pennylane',
    docsUrl: 'https://pennylane.readme.io/reference/getcustomerinvoices',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: { type: 'cron', expression: String(params['schedule'] ?? '30 7 * * *') },
    actions: [
      {
        name: 'fetch',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'pennylane',
          operation: 'get-customer-invoices',
          params: { limit: 100 },
          paginate: 'all',
        },
      },
      {
        name: 'fresh',
        type: 'state',
        operator: 'filterNew',
        props: { input: '{{steps.fetch.data}}', key: 'id', namespace: 'pennylane' },
      },
      {
        name: 'fileEach',
        type: 'loop',
        operator: 'each',
        props: {
          items: '{{steps.fresh.items}}',
          actions: [
            {
              name: 'fileInvoice',
              type: 'record',
              operator: 'create',
              props: {
                table: String(params['table'] ?? 'customer_invoices'),
                data: {
                  pennylane_id: '{{loop.item.id}}',
                  invoice_number: '{{loop.item.invoice_number}}',
                  amount: '{{loop.item.amount}}',
                  invoice_date: '{{loop.item.date}}',
                  status: '{{loop.item.status}}',
                },
              },
            },
          ],
        },
      },
    ],
  }),
})
