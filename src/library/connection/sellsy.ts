/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Sellsy's API v2 through a private OAuth client: authorization code with
 * PKCE, which Sellsy requires on that flow.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'sellsy',
  title: 'CRM and invoicing with Sellsy (OAuth)',
  category: 'sales',
  tags: ['sellsy', 'crm', 'invoicing', 'quotes', 'companies', 'sales'],
  description: 'A Sellsy account connected with OAuth, for calls to the Sellsy API v2.',
  notes: [
    'Create a private API access in Sellsy under Settings, Developer portal, API accesses, register the redirect URI `sovrium library add` prints, and set the client id and secret as environment variables. Then connect the account from your app once.',
    'Sellsy requires PKCE on this flow, which the connection sends. The connection declares no operation yet: call `https://api.sellsy.com/v2/...` from an `http` step naming it, or declare the endpoints you use under `operations`.',
  ],
  params: [],
  env: ['SELLSY_CLIENT_ID', 'SELLSY_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Sellsy',
    docsUrl: 'https://help.sellsy.com/fr/articles/5876614-api-v2',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Sellsy',
    description: 'Sellsy API v2, connected with OAuth',
    props: {
      clientId: '$env.SELLSY_CLIENT_ID',
      clientSecret: '$env.SELLSY_CLIENT_SECRET',
      authorizationUrl: 'https://login.sellsy.com/oauth2/authorization',
      tokenUrl: 'https://login.sellsy.com/oauth2/access-tokens',
      pkce: 'S256',
    },
    baseUrl: 'https://api.sellsy.com/v2',
  }),
})
