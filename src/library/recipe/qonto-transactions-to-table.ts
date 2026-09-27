/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Every morning, the Qonto transactions not seen before become rows of one of
 * the operator's tables. `state` / `filterNew` remembers the ids already filed,
 * so a transaction is filed once however often the page repeats it, and the
 * first run files nothing rather than replaying the account's history.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'qonto-transactions-to-table',
  title: 'File new Qonto transactions into a table every morning',
  category: 'finance',
  tags: ['qonto', 'bank', 'transactions', 'cron', 'bookkeeping', 'sync'],
  description:
    'A scheduled automation that reads the completed transactions of a Qonto account and adds each one not seen before as a row of your table.',
  notes: [
    'The automation runs on the schedule `schedule` (07:00 every day by default), reads every page of completed transactions of the account `bankAccountId` through the `list-transactions` operation of the `qonto` connection, keeps the ones it has not filed before, and creates one row per transaction in the table named by `table`.',
    'Its first run files nothing: it remembers the transactions already on the account so that switching it on does not replay the history. Point it at your own table with `--set table=<your table>`; the table needs the fields listed below.',
  ],
  params: [
    {
      name: 'bankAccountId',
      description:
        'The id of the Qonto account to read, as the get-organization operation lists it.',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table each new transaction is added to.',
      type: 'string',
      default: 'bank_transactions',
    },
    {
      name: 'schedule',
      description: 'When to run, as a cron expression.',
      type: 'string',
      default: '0 7 * * *',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'transaction_id', type: 'single-line-text' },
        { name: 'label', type: 'single-line-text' },
        { name: 'amount', type: 'decimal' },
        { name: 'settled_at', type: 'datetime' },
      ],
    },
  ],
  env: [],
  requires: ['connection/qonto'],
  provider: {
    name: 'Qonto',
    docsUrl:
      'https://docs.qonto.com/api-reference/business-api/transactions-statements/transactions/list-transactions',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: { type: 'cron', expression: String(params['schedule'] ?? '0 7 * * *') },
    actions: [
      {
        name: 'fetch',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'qonto',
          operation: 'list-transactions',
          params: { bank_account_id: String(params['bankAccountId'] ?? ''), per_page: 100 },
          paginate: 'all',
        },
      },
      {
        name: 'fresh',
        type: 'state',
        operator: 'filterNew',
        props: { input: '{{steps.fetch.data}}', key: 'transaction_id', namespace: 'qonto' },
      },
      {
        name: 'fileEach',
        type: 'loop',
        operator: 'each',
        props: {
          items: '{{steps.fresh.items}}',
          actions: [
            {
              name: 'fileTransaction',
              type: 'record',
              operator: 'create',
              props: {
                table: String(params['table'] ?? 'bank_transactions'),
                data: {
                  transaction_id: '{{loop.item.transaction_id}}',
                  label: '{{loop.item.label}}',
                  amount: '{{loop.item.amount}}',
                  settled_at: '{{loop.item.settled_at}}',
                },
              },
            },
          ],
        },
      },
    ],
  }),
})
