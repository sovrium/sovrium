/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const PAGE = { in: 'query', type: 'integer', description: 'Page number, from 1' } as const
const PER_PAGE = { in: 'query', type: 'integer', description: 'Items per page, 1 to 50' } as const

/** Hand-picked: Aircall publishes no OpenAPI description. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-calls',
    method: 'GET',
    path: '/calls',
    summary: 'List calls, most recent first',
    params: {
      from: { in: 'query', type: 'integer', description: 'Start of the period, Unix timestamp' },
      to: { in: 'query', type: 'integer', description: 'End of the period, Unix timestamp' },
      order: { in: 'query', type: 'string', enum: ['asc', 'desc'] },
      page: PAGE,
      per_page: PER_PAGE,
    },
    pagination: { style: 'page', pageParam: 'page', itemsPath: 'calls' },
  },
  {
    name: 'get-call',
    method: 'GET',
    path: '/calls/{id}',
    summary: 'Retrieve one call',
    params: { id: { in: 'path', type: 'integer', required: true } },
  },
  {
    name: 'list-contacts',
    method: 'GET',
    path: '/contacts',
    summary: 'List the shared contacts',
    params: { page: PAGE, per_page: PER_PAGE },
    pagination: { style: 'page', pageParam: 'page', itemsPath: 'contacts' },
  },
  {
    name: 'get-contact',
    method: 'GET',
    path: '/contacts/{id}',
    summary: 'Retrieve one contact',
    params: { id: { in: 'path', type: 'integer', required: true } },
  },
]

/** Aircall's public API, authenticated with HTTP Basic: the API id and the API token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'aircall',
  title: 'Phone calls with Aircall (API id and token)',
  category: 'communication',
  tags: ['aircall', 'phone', 'calls', 'telephony', 'contacts', 'support'],
  description:
    'Authenticated calls to the Aircall public API, with operations to read calls and contacts.',
  notes: [
    'Aircall authenticates with HTTP Basic: the API id as the username and the API token as the password. Create both in the Aircall dashboard under Integrations, API Keys, and set them as the two environment variables.',
    '`list-calls` and `list-contacts` page by number, 50 items at most per page; call them with `paginate: all` to read every page. Aircall caps a listing at 10,000 items even when paginated.',
  ],
  params: [],
  env: ['AIRCALL_API_ID', 'AIRCALL_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Aircall',
    docsUrl: 'https://developers.aircall.io/api-references',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Aircall',
    description: 'Aircall public API, authenticated with the API id and token',
    props: { username: '$env.AIRCALL_API_ID', password: '$env.AIRCALL_API_TOKEN' },
    baseUrl: 'https://api.aircall.io/v1',
    operations: OPERATIONS,
  }),
})
