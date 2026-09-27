/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * The starter operation, byte-for-byte the one the generated HubSpot set
 * carries, so installing it again later is a no-op.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'post-v3-objects-contacts',
    method: 'POST',
    path: '/v3/objects/contacts',
    summary: 'Create a contact',
    params: {
      associations: { in: 'body', type: 'array', required: true },
      properties: { in: 'body', type: 'object', required: true },
    },
  },
]

/** HubSpot's CRM API with the access token of a private app. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'hubspot',
  title: 'CRM with HubSpot (private app token)',
  category: 'sales',
  tags: ['hubspot', 'crm', 'contacts', 'deals', 'companies', 'sales'],
  description:
    'Authenticated calls to the HubSpot CRM API with the access token of a private app, starting with contact creation.',
  notes: [
    'Create a private app in HubSpot under Settings, Integrations, Private Apps, give it the CRM scopes your automations need (`crm.objects.contacts.write` for the operation installed here) and set its access token as the environment variable. HubSpot reads it as `Authorization: Bearer <token>`.',
    'The connection ships with `post-v3-objects-contacts`: pass the contact fields in `properties` and an empty `associations` list when the contact is linked to nothing. Add other CRM endpoints with `sovrium library add hubspot/<operation>`.',
  ],
  params: [],
  env: ['HUBSPOT_ACCESS_TOKEN'],
  requires: [],
  provider: {
    name: 'HubSpot',
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'HubSpot',
    description: 'HubSpot CRM API, authenticated with a private app token',
    props: { token: '$env.HUBSPOT_ACCESS_TOKEN' },
    baseUrl: 'https://api.hubapi.com/crm',
    operations: OPERATIONS,
  }),
})
