/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Read-only payroll and HR data of one company, from the PayFit partner API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-company',
    method: 'GET',
    path: '/companies/{companyId}',
    summary: 'Read the company the connection was authorized for',
    params: { companyId: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-collaborators',
    method: 'GET',
    path: '/companies/{companyId}/collaborators',
    summary: 'List the employees of the company',
    params: { companyId: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-contracts',
    method: 'GET',
    path: '/companies/{companyId}/contracts',
    summary: 'List the employment contracts of the company',
    params: { companyId: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-absences',
    method: 'GET',
    path: '/companies/{companyId}/absences',
    summary: 'List the absences recorded for the company',
    params: { companyId: { in: 'path', type: 'string', required: true } },
  },
]

/** PayFit payroll with OAuth: one company per authorization. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'payfit',
  title: 'Payroll and HR with PayFit (OAuth)',
  category: 'hr',
  tags: ['payfit', 'payroll', 'hr', 'employees', 'contracts', 'absences'],
  description:
    'A PayFit company connected with OAuth, with read operations for its employees, contracts and absences.',
  notes: [
    'PayFit opens its API to registered partners: request partner access from PayFit, register the redirect URI `sovrium library add` prints on the OAuth client PayFit gives you, and set its client id and secret as environment variables. Then an administrator of the company connects it from your app once.',
    'Each authorization covers exactly one company, the one of the person who connected it, and the operations take that company id as `companyId`. The client is granted the scopes PayFit agreed for your partner access; list them under `scopes` if PayFit asks you to request them explicitly.',
  ],
  params: [],
  env: ['PAYFIT_CLIENT_ID', 'PAYFIT_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'PayFit',
    docsUrl: 'https://developers.payfit.io/reference',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'PayFit',
    description: 'PayFit partner API, connected with OAuth',
    props: {
      clientId: '$env.PAYFIT_CLIENT_ID',
      clientSecret: '$env.PAYFIT_CLIENT_SECRET',
      authorizationUrl: 'https://oauth.payfit.com/authorize',
      tokenUrl: 'https://oauth.payfit.com/token',
    },
    baseUrl: 'https://partner-api.payfit.com',
    operations: OPERATIONS,
  }),
})
