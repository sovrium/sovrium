/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Tickets of the Zendesk Support API: open one, read one, reply, search. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-ticket',
    method: 'POST',
    path: '/tickets',
    summary: 'Open a ticket',
    params: {
      ticket: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ subject, comment: { body }, requester: { name, email }, priority, tags }',
      },
    },
  },
  {
    name: 'get-ticket',
    method: 'GET',
    path: '/tickets/{ticket_id}',
    summary: 'Read a ticket',
    params: { ticket_id: { in: 'path', type: 'integer', required: true } },
  },
  {
    name: 'update-ticket',
    method: 'PUT',
    path: '/tickets/{ticket_id}',
    summary: 'Update a ticket or add a comment to it',
    params: {
      ticket_id: { in: 'path', type: 'integer', required: true },
      ticket: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ status, comment: { body, public } } and any field to change',
      },
    },
  },
  {
    name: 'search',
    method: 'GET',
    path: '/search',
    summary: 'Search tickets, users and organizations with the Zendesk query syntax',
    params: {
      query: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'e.g. type:ticket status:open',
      },
      sort_by: { in: 'query', type: 'string' },
      sort_order: { in: 'query', type: 'string', enum: ['asc', 'desc'] },
    },
  },
]

/** Zendesk Support, authenticated with an agent's email and an API token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'zendesk',
  title: 'Customer support with Zendesk (API token)',
  category: 'support',
  tags: ['zendesk', 'support', 'tickets', 'helpdesk', 'customer-service'],
  description:
    'Authenticated calls to the Zendesk Support API, with operations to open, read, update and search tickets.',
  notes: [
    'Turn on token access in Zendesk Admin Center under Apps and integrations, Zendesk API, and add an API token. Set it as `ZENDESK_API_TOKEN`, the email of the agent the calls act as as `ZENDESK_EMAIL`, and your subdomain — the `mycompany` of `mycompany.zendesk.com` — as `ZENDESK_SUBDOMAIN`. Zendesk authenticates with HTTP Basic, the username being the email followed by `/token`.',
    'A ticket created through the API is attributed to its `requester`, created on the fly when the email is new. Give a comment `public: false` in `update-ticket` to add an internal note rather than a reply the requester receives.',
  ],
  params: [],
  env: ['ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Zendesk',
    docsUrl: 'https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Zendesk',
    description: 'Zendesk Support API, authenticated with an agent email and API token',
    props: { username: '$env.ZENDESK_EMAIL/token', password: '$env.ZENDESK_API_TOKEN' },
    baseUrl: 'https://$env.ZENDESK_SUBDOMAIN.zendesk.com/api/v2',
    operations: OPERATIONS,
  }),
})
