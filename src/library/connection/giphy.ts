/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * The search a composer's GIF picker sends, and the lookup of one GIF by id the
 * server uses to find a picked GIF's media again when it no longer holds the
 * search that answered it. GIPHY reads its key from the query string
 * (`api_key`), which the connection adds itself: the key is never an operation
 * parameter, so no page and no step can name it.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'search',
    method: 'GET',
    path: '/v1/gifs/search',
    summary: 'Search GIFs by words',
    params: {
      q: { in: 'query', type: 'string', required: true, description: 'The words searched for.' },
      limit: { in: 'query', type: 'integer', description: 'How many results, at most 50.' },
      rating: {
        in: 'query',
        type: 'string',
        enum: ['g', 'pg', 'pg-13', 'r'],
        description: 'The highest content rating returned.',
      },
      lang: { in: 'query', type: 'string', description: 'The language of the words, as a code.' },
    },
  },
  {
    name: 'get',
    method: 'GET',
    path: '/v1/gifs/{gif_id}',
    summary: 'Get one GIF by id',
    params: {
      gif_id: { in: 'path', type: 'string', required: true, description: "The GIF's GIPHY id." },
    },
  },
]

/** GIPHY's search API, the first adapter of a composer's GIF picker. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'giphy',
  title: 'GIPHY GIF search (API key)',
  category: 'community',
  tags: ['giphy', 'gif', 'composer', 'chat', 'conversation', 'search'],
  description:
    'GIF search through the GIPHY API with your key, for the GIF picker of a conversation composer.',
  notes: [
    'Create an app in the GIPHY developer dashboard and set its API key as the environment variable. The connection sends it in the `api_key` query parameter GIPHY reads, from the server only: the key never reaches a browser.',
    "Turn the picker on in a composer with `gif: { connection: giphy, field: <url field> }`. Searches, thumbnails and posted GIFs all go through your app: the server fetches each GIF from GIPHY once, caches it and serves it, and the field stores the app's own address of the GIF. A member's browser never contacts GIPHY.",
    'The `search` operation is also callable from an automation step, with `q` and an optional `limit` and `rating`; `get` reads one GIF by its `gif_id`.',
  ],
  params: [],
  env: ['GIPHY_API_KEY'],
  requires: [],
  provider: {
    name: 'GIPHY',
    docsUrl: 'https://developers.giphy.com/docs/api/endpoint/#search',
    verifiedOn: '2026-10-22',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'GIPHY',
    description: 'GIPHY API, authenticated with an API key in the query string',
    props: { key: '$env.GIPHY_API_KEY', query: 'api_key' },
    baseUrl: 'https://api.giphy.com',
    operations: OPERATIONS,
  }),
})
