/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Notion reads the API version from this header on every call. */
const NOTION_VERSION = {
  in: 'header',
  type: 'string',
  required: true,
  enum: ['2026-03-11'],
  description: 'API version Notion answers in; pass 2026-03-11',
} as const

/** Hand-picked: Notion publishes no OpenAPI description. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-page',
    method: 'POST',
    path: '/pages',
    summary: 'Create a page under a page, a database or a data source',
    params: {
      'Notion-Version': NOTION_VERSION,
      parent: {
        in: 'body',
        type: 'object',
        required: true,
        description: 'One of { page_id }, { database_id } or { data_source_id }',
      },
      properties: { in: 'body', type: 'object', description: 'Property values by name' },
      markdown: { in: 'body', type: 'string', description: 'Page content as Markdown' },
      children: { in: 'body', type: 'array', description: 'Block objects, at most 100' },
    },
  },
  {
    name: 'get-page',
    method: 'GET',
    path: '/pages/{page_id}',
    summary: 'Retrieve a page and its property values',
    params: {
      'Notion-Version': NOTION_VERSION,
      page_id: { in: 'path', type: 'string', required: true },
    },
  },
  {
    name: 'update-page',
    method: 'PATCH',
    path: '/pages/{page_id}',
    summary: 'Update property values of a page, or archive it',
    params: {
      'Notion-Version': NOTION_VERSION,
      page_id: { in: 'path', type: 'string', required: true },
      properties: { in: 'body', type: 'object' },
      in_trash: { in: 'body', type: 'boolean' },
    },
  },
  {
    name: 'query-data-source',
    method: 'POST',
    path: '/data_sources/{data_source_id}/query',
    summary: 'List the pages of a data source, filtered and sorted',
    params: {
      'Notion-Version': NOTION_VERSION,
      data_source_id: { in: 'path', type: 'string', required: true },
      filter: { in: 'body', type: 'object' },
      sorts: { in: 'body', type: 'array' },
      start_cursor: { in: 'body', type: 'string' },
      page_size: { in: 'body', type: 'integer', description: 'At most 100' },
    },
  },
  {
    name: 'search',
    method: 'POST',
    path: '/search',
    summary: 'Search the pages and data sources shared with the integration by title',
    params: {
      'Notion-Version': NOTION_VERSION,
      query: { in: 'body', type: 'string' },
      filter: { in: 'body', type: 'object' },
      start_cursor: { in: 'body', type: 'string' },
      page_size: { in: 'body', type: 'integer' },
    },
  },
]

/** Notion's API with the token of an internal integration. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'notion',
  title: 'Pages and databases in Notion (integration token)',
  category: 'productivity',
  tags: ['notion', 'pages', 'databases', 'wiki', 'notes', 'productivity'],
  description:
    'Authenticated calls to the Notion API with an internal integration token, with operations to create, read, update and search pages.',
  notes: [
    'Create an internal integration in Notion under Settings, Connections, Develop or manage integrations, copy its token and set it as the environment variable. Then share each page or database the automations use with the integration, from its Connections menu: Notion answers 404 for anything not shared.',
    'Every operation takes the API version as a required `Notion-Version` header parameter; pass `2026-03-11`. Notion pages query results by cursor in the request body: pass the `next_cursor` of one answer as `start_cursor` to read the next.',
  ],
  params: [],
  env: ['NOTION_TOKEN'],
  requires: [],
  provider: {
    name: 'Notion',
    docsUrl: 'https://developers.notion.com/reference/authentication',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Notion',
    description: 'Notion API, authenticated with an internal integration token',
    props: { token: '$env.NOTION_TOKEN' },
    baseUrl: 'https://api.notion.com/v1',
    operations: OPERATIONS,
  }),
})
