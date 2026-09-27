/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Contentsquare's APIs: a JSON token request with the client id and secret,
 * answered with a bearer valid one hour. It is a token exchange rather than an
 * OAuth client-credentials connection because Contentsquare reads the request
 * as JSON, where the OAuth grant sends form fields.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'contentsquare',
  title: 'Experience analytics with Contentsquare (OAuth credentials)',
  category: 'analytics',
  tags: ['contentsquare', 'analytics', 'export', 'ux', 'data'],
  description:
    'Machine-to-machine calls to the Contentsquare APIs with an OAuth client id and secret, the token requested and renewed by Sovrium.',
  notes: [
    'Create OAuth credentials in the Contentsquare console under Console, Projects, API credentials, and set the client id and secret as environment variables. The token request asks for the `data-export` scope.',
    'Contentsquare answers the token request with the API address of the cloud your project lives on, as `endpoint`. Set it once as `CONTENTSQUARE_API_BASE_URL` (for example the address printed in the console) and call the Export API from an `http` step naming this connection, or declare its endpoints under `operations`.',
  ],
  params: [],
  env: ['CONTENTSQUARE_CLIENT_ID', 'CONTENTSQUARE_CLIENT_SECRET', 'CONTENTSQUARE_API_BASE_URL'],
  requires: [],
  provider: {
    name: 'Contentsquare',
    docsUrl: 'https://docs.contentsquare.com/en/api/export/authentication/',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'tokenExchange',
    label: 'Contentsquare',
    description: 'Contentsquare APIs, authenticated with OAuth client credentials',
    props: {
      tokenUrl: 'https://api.contentsquare.com/v1/oauth/token',
      body: {
        client_id: '$env.CONTENTSQUARE_CLIENT_ID',
        client_secret: '$env.CONTENTSQUARE_CLIENT_SECRET',
        grant_type: 'client_credentials',
        scope: 'data-export',
      },
      bodyType: 'json',
    },
    baseUrl: '$env.CONTENTSQUARE_API_BASE_URL',
  }),
})
