/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Brevo's v3 API, authenticated by its `api-key` header. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'brevo',
  title: 'Brevo email marketing (API key)',
  category: 'marketing',
  tags: ['brevo', 'email', 'contacts', 'newsletter', 'marketing'],
  description: 'Authenticated calls to the Brevo API with an API key.',
  notes: [
    'Brevo reads the key from an `api-key` header. Create a key in your Brevo account under SMTP & API, API keys, and set it as the environment variable.',
    'Call the API at `https://api.brevo.com/v3/...` from an `http` action that names this connection.',
  ],
  params: [],
  env: ['BREVO_API_KEY'],
  requires: [],
  provider: {
    name: 'Brevo',
    docsUrl: 'https://developers.brevo.com/docs/getting-started',
    verifiedOn: '2026-09-23',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Brevo',
    description: 'Brevo API, authenticated with an API key',
    props: {
      key: '$env.BREVO_API_KEY',
      header: 'api-key',
    },
  }),
})
