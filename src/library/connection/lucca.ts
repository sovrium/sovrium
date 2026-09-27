/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * The Lucca API: OAuth2 client credentials against Lucca's identity server,
 * then a bearer token on the customer's own host, which is why the base URL is
 * an environment variable.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'lucca',
  title: 'HR data with Lucca (OAuth client credentials)',
  category: 'hr',
  tags: ['lucca', 'hr', 'employees', 'departments', 'leaves', 'people'],
  description:
    'Machine-to-machine calls to the Lucca API with an OAuth application of your Lucca account.',
  notes: [
    'Create an OAuth application in Lucca under Settings, Authentication, SSO and API, OAuth Applications, grant it the scopes the operations you call need, and set its client id and secret as environment variables. Set `LUCCA_BASE_URL` to your own Lucca address, of the form `https://<your-account>.ilucca.net`.',
    'Sovrium requests the token itself with the client credentials grant, keeps it encrypted and requests a new one when it expires, about every 30 minutes; no one has to authorize anything. The connection declares no operation yet: add the endpoints you need with `sovrium library add lucca/<operation>`. Each of them takes the API version as a required `Api-Version` header parameter; pass the value it lists, for example `2024-11-01`.',
  ],
  params: [],
  env: ['LUCCA_CLIENT_ID', 'LUCCA_CLIENT_SECRET', 'LUCCA_BASE_URL'],
  requires: [],
  provider: {
    name: 'Lucca',
    docsUrl: 'https://developers.luccasoftware.com/documentation/using-api/authentication',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Lucca',
    description: 'Lucca API, authenticated with an OAuth application (client credentials)',
    props: {
      clientId: '$env.LUCCA_CLIENT_ID',
      clientSecret: '$env.LUCCA_CLIENT_SECRET',
      tokenUrl: 'https://accounts.world.luccasoftware.com/connect/token',
      grantType: 'clientCredentials',
      authenticationMethod: 'body',
    },
    baseUrl: '$env.LUCCA_BASE_URL',
  }),
})
