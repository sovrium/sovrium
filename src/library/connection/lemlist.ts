/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * lemlist's API: HTTP Basic with an EMPTY username and the API key as the
 * password — the pair on the wire is `:<key>`, which the `basic` connection
 * sends as such when its username is empty.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'lemlist',
  title: 'Sales outreach with lemlist (API key)',
  category: 'sales',
  tags: ['lemlist', 'outreach', 'prospecting', 'campaigns', 'sales', 'email'],
  description: 'Authenticated calls to the lemlist API with an API key.',
  notes: [
    'lemlist authenticates with HTTP Basic, an empty username and your API key as the password. Create the key in lemlist under Settings, Integrations, API and set it as the environment variable.',
    'The connection declares no operation yet: add the endpoints you need with `sovrium library add lemlist/<operation>`, or list them with `sovrium library search lemlist`.',
  ],
  params: [],
  env: ['LEMLIST_API_KEY'],
  requires: [],
  provider: {
    name: 'lemlist',
    docsUrl: 'https://developer.lemlist.com/api-reference/getting-started/authentication',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'lemlist',
    description: 'lemlist API, authenticated with an API key as the Basic password',
    props: { username: '', password: '$env.LEMLIST_API_KEY' },
    baseUrl: 'https://api.lemlist.com/api',
  }),
})
