/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Hand-picked: Qonto publishes no OpenAPI description. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-transactions',
    method: 'GET',
    path: '/transactions',
    summary: 'List the transactions of one bank account, completed ones by default',
    params: {
      bank_account_id: { in: 'query', type: 'string', description: 'Takes precedence over iban' },
      iban: { in: 'query', type: 'string', format: 'iban' },
      'status[]': {
        in: 'query',
        type: 'array',
        items: { enum: ['pending', 'completed', 'declined'] },
      },
      updated_at_from: { in: 'query', type: 'string', format: 'date-time' },
      settled_at_from: { in: 'query', type: 'string', format: 'date-time' },
      sort_by: { in: 'query', type: 'string', enum: ['settled_at:asc', 'settled_at:desc'] },
      per_page: { in: 'query', type: 'integer', description: 'At most 100' },
      current_page: { in: 'query', type: 'integer' },
    },
    pagination: {
      style: 'page',
      pageParam: 'current_page',
      itemsPath: 'transactions',
      nextPath: 'meta.next_page',
    },
  },
  {
    name: 'get-transaction',
    method: 'GET',
    path: '/transactions/{id}',
    summary: 'Retrieve one transaction',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'get-organization',
    method: 'GET',
    path: '/organization',
    summary: 'Retrieve the organization and its bank accounts, with their ids and IBANs',
  },
]

/**
 * Qonto's Business API key authentication.
 *
 * Qonto reads ONE header, `Authorization`, holding the organization login and
 * the secret key joined by a colon — no scheme word and no Base64. That is why
 * this is an `apiKey` connection with a literal `Authorization` header rather
 * than a `basic` one: Basic auth would Base64-encode the pair, which Qonto
 * refuses.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'qonto',
  title: 'Business banking with Qonto (API key)',
  category: 'finance',
  tags: ['qonto', 'bank', 'banking', 'transactions', 'finance'],
  description:
    'Authenticated calls to the Qonto Business API with your organization login and secret key.',
  notes: [
    'Qonto authenticates with one `Authorization` header holding the organization login and the secret key joined by a colon, with no scheme word and no Base64 encoding. The connection builds that header from your two environment variables.',
    'Find both values in the Qonto app under Integrations and Partnerships, API key. The connection ships with `list-transactions`, `get-transaction` and `get-organization`; `get-organization` lists your bank accounts with the identifiers `list-transactions` needs to name one. `list-transactions` returns completed transactions unless `status[]` asks for others, and pages by number: call it with `paginate: all` to read every page.',
  ],
  params: [],
  env: ['QONTO_LOGIN', 'QONTO_SECRET_KEY'],
  requires: [],
  provider: {
    name: 'Qonto',
    docsUrl: 'https://docs.qonto.com/get-started/business-api/authentication/api-key',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Qonto',
    description: 'Qonto Business API, authenticated with the organization login and secret key',
    props: {
      key: '$env.QONTO_LOGIN:$env.QONTO_SECRET_KEY',
      header: 'Authorization',
    },
    baseUrl: 'https://thirdparty.qonto.com/v2',
    operations: OPERATIONS,
  }),
})
