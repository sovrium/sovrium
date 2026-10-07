/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Swan exposes ONE GraphQL endpoint, so the connection declares one operation
 * that sends a query and its variables; what it reads or changes is the query.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'graphql',
    method: 'POST',
    path: '/graphql',
    summary: 'Run a query or a mutation of the Swan partner API',
    params: {
      query: { in: 'body', type: 'string', required: true, description: 'The GraphQL document' },
      variables: { in: 'body', type: 'object' },
      operationName: { in: 'body', type: 'string' },
    },
  },
]

/** Swan banking with a project access token (client credentials). */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'swan',
  title: 'Embedded banking with Swan (OAuth client credentials, GraphQL)',
  category: 'finance',
  tags: ['swan', 'bank', 'banking', 'payments', 'accounts', 'graphql'],
  description:
    "Machine-to-machine calls to the Swan partner GraphQL API with your project's credentials.",
  notes: [
    'Copy the client id and secret of your project from the Swan dashboard, under Developers, API, and set them as environment variables. Sovrium requests a project access token with the client credentials grant and renews it when it expires; no one has to authorize anything.',
    'Live and sandbox are separate projects with separate credentials and separate addresses: the entry calls the sandbox until you install it with `--set environment=live`. The single `graphql` operation sends the query or mutation you write, for example `query { accounts { edges { node { id name } } } }`; the API explorer in the Swan dashboard lists every field. Actions that move money ask the account holder for consent in Swan, which a server-side call cannot give on their behalf.',
  ],
  params: [
    {
      name: 'environment',
      description: 'The Swan environment the project belongs to: sandbox or live.',
      type: 'string',
      default: 'sandbox',
    },
  ],
  env: ['SWAN_CLIENT_ID', 'SWAN_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Swan',
    docsUrl: 'https://docs.swan.io/developers/using-api/authentication/guide-get-token-project',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    type: 'oauth2',
    label: 'Swan',
    description: 'Swan partner GraphQL API, authenticated with the project credentials',
    props: {
      clientId: '$env.SWAN_CLIENT_ID',
      clientSecret: '$env.SWAN_CLIENT_SECRET',
      tokenUrl: 'https://oauth.swan.io/oauth2/token',
      grantType: 'clientCredentials',
      authenticationMethod: 'body',
    },
    baseUrl: `https://api.swan.io/${params['environment'] === 'live' ? 'live' : 'sandbox'}-partner`,
    operations: OPERATIONS,
  }),
})
