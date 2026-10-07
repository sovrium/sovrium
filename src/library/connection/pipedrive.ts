/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * People, leads and deals. Persons and deals are on the API v2; leads are
 * still on v1, so the paths carry their version and the base URL does not.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-person',
    method: 'POST',
    path: '/api/v2/persons',
    summary: 'Create a person',
    params: {
      name: { in: 'body', type: 'string', required: true },
      emails: { in: 'body', type: 'array', description: 'Items { value, primary, label }' },
      phones: { in: 'body', type: 'array', description: 'Items { value, primary, label }' },
      org_id: { in: 'body', type: 'integer' },
      owner_id: { in: 'body', type: 'integer' },
    },
  },
  {
    name: 'search-persons',
    method: 'GET',
    path: '/api/v2/persons/search',
    summary: 'Find persons by name, email or phone',
    params: {
      term: { in: 'query', type: 'string', required: true, description: 'At least 2 characters' },
      fields: { in: 'query', type: 'string', description: 'e.g. email,name' },
      exact_match: { in: 'query', type: 'boolean' },
    },
  },
  {
    name: 'create-lead',
    method: 'POST',
    path: '/v1/leads',
    summary: 'Create a lead linked to a person or an organization',
    params: {
      title: { in: 'body', type: 'string', required: true },
      person_id: { in: 'body', type: 'integer' },
      organization_id: { in: 'body', type: 'integer' },
      owner_id: { in: 'body', type: 'integer' },
      label_ids: { in: 'body', type: 'array', items: { type: 'string' } },
    },
  },
  {
    name: 'list-deals',
    method: 'GET',
    path: '/api/v2/deals',
    summary: 'List deals, optionally by status or owner',
    params: {
      status: { in: 'query', type: 'string', enum: ['open', 'won', 'lost', 'deleted'] },
      owner_id: { in: 'query', type: 'integer' },
      limit: { in: 'query', type: 'integer' },
      cursor: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'cursor',
      cursorPath: 'additional_data.next_cursor',
      itemsPath: 'data',
    },
  },
]

/** Pipedrive CRM, authenticated with a personal API token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'pipedrive',
  title: 'Sales pipeline with Pipedrive (API token)',
  category: 'sales',
  tags: ['pipedrive', 'crm', 'leads', 'deals', 'persons', 'sales'],
  description:
    'Authenticated calls to the Pipedrive API, with operations for persons, leads and deals.',
  notes: [
    "Copy your personal API token from Pipedrive, under your profile, Personal preferences, API, and set it as `PIPEDRIVE_API_TOKEN`. The connection sends it in the `x-api-token` header; calls run with your user's visibility in the company.",
    'A lead must be linked to a person or an organization: create or find the person first, then pass its id as `person_id`. `list-deals` pages with a cursor; call it with `paginate: all` to read every page.',
  ],
  params: [],
  env: ['PIPEDRIVE_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Pipedrive',
    docsUrl: 'https://pipedrive.readme.io/docs/core-api-concepts-authentication',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Pipedrive',
    description: 'Pipedrive API, authenticated with a personal API token',
    props: { key: '$env.PIPEDRIVE_API_TOKEN', header: 'x-api-token' },
    baseUrl: 'https://api.pipedrive.com',
    operations: OPERATIONS,
  }),
})
