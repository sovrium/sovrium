/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const VERSION = {
  in: 'header',
  type: 'string',
  description: 'The API version to call, e.g. 2.14; the workspace default otherwise',
} as const

/** Contacts and conversations of the Intercom API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-contact',
    method: 'POST',
    path: '/contacts',
    summary: 'Create a user or a lead',
    params: {
      'Intercom-Version': VERSION,
      role: { in: 'body', type: 'string', required: true, enum: ['user', 'lead'] },
      email: { in: 'body', type: 'string', format: 'email' },
      name: { in: 'body', type: 'string' },
      phone: { in: 'body', type: 'string' },
      external_id: { in: 'body', type: 'string' },
      custom_attributes: { in: 'body', type: 'object' },
    },
  },
  {
    name: 'search-contacts',
    method: 'POST',
    path: '/contacts/search',
    summary: 'Find contacts matching a query, such as an email',
    params: {
      'Intercom-Version': VERSION,
      query: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ field: email, operator: =, value }',
      },
    },
  },
  {
    name: 'create-conversation',
    method: 'POST',
    path: '/conversations',
    summary: 'Start a conversation on behalf of a contact',
    params: {
      'Intercom-Version': VERSION,
      from: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ type: user, lead or contact, id }',
      },
      body: { in: 'body', type: 'string', required: true },
    },
  },
]

/** Intercom, authenticated with the access token of a private app. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'intercom',
  title: 'Customer messaging with Intercom (access token)',
  category: 'support',
  tags: ['intercom', 'support', 'contacts', 'conversations', 'messaging'],
  description:
    'Authenticated calls to the Intercom API, with operations to create and find contacts and start conversations.',
  notes: [
    'Create an app in the Intercom Developer Hub for your own workspace, copy its access token from the Authentication page and set it as `INTERCOM_ACCESS_TOKEN`. A token of an app used only by your workspace does not need the OAuth flow.',
    "Each operation accepts an `Intercom-Version` header; without it the workspace's default API version answers. A workspace hosted in Europe or Australia is served from its own address: install with `--set apiUrl=https://api.eu.intercom.io` or `https://api.au.intercom.io`.",
  ],
  params: [
    {
      name: 'apiUrl',
      description: "The Intercom API address of your workspace's region.",
      type: 'string',
      default: 'https://api.intercom.io',
    },
  ],
  env: ['INTERCOM_ACCESS_TOKEN'],
  requires: [],
  provider: {
    name: 'Intercom',
    docsUrl:
      'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/contacts/createcontact',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    type: 'bearer',
    label: 'Intercom',
    description: 'Intercom API, authenticated with an access token',
    props: { token: '$env.INTERCOM_ACCESS_TOKEN' },
    baseUrl: String(params['apiUrl'] ?? 'https://api.intercom.io'),
    operations: OPERATIONS,
  }),
})
