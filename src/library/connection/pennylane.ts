/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * The starter operation, byte-for-byte the one the generated Pennylane set
 * carries, so installing that operation later over this connection is a no-op.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-customer-invoices',
    method: 'GET',
    path: '/customer_invoices',
    summary: 'List customer invoices',
    params: {
      cursor: { in: 'query', type: 'string' },
      limit: { in: 'query', type: 'integer' },
      filter: { in: 'query', type: 'string' },
      sort: { in: 'query', type: 'string' },
      include: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'cursor',
      cursorPath: 'next_cursor',
      itemsPath: 'items',
    },
  },
]

/** Pennylane's company API (v2), authenticated by a company API token sent as a bearer. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'pennylane',
  title: 'Accounting with Pennylane (API token)',
  category: 'finance',
  tags: ['pennylane', 'accounting', 'invoices', 'bookkeeping', 'finance'],
  description:
    'Authenticated calls to the Pennylane company API with a company API token, starting with the list of customer invoices.',
  notes: [
    'Generate a company API token in Pennylane under Settings, Connectivity, Developers, choose the scopes it may use (read access to customer invoices for the operation installed here) and set it as the environment variable. Pennylane sends it as `Authorization: Bearer <token>`.',
    'The connection ships with `get-customer-invoices`, paginated by cursor: call it with `paginate: all` to read every invoice. Every other endpoint of the Pennylane API can be added to it one by one with `sovrium library add pennylane/<operation>`.',
  ],
  params: [],
  env: ['PENNYLANE_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Pennylane',
    docsUrl: 'https://pennylane.readme.io/docs/generating-my-api-token',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Pennylane',
    description: 'Pennylane company API, authenticated with a company API token',
    props: { token: '$env.PENNYLANE_API_TOKEN' },
    baseUrl: 'https://app.pennylane.com/api/external/v2',
    operations: OPERATIONS,
  }),
})
