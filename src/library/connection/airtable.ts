/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const BASE_AND_TABLE = {
  baseId: { in: 'path', type: 'string', required: true, description: 'Base id, starting with app' },
  tableIdOrName: { in: 'path', type: 'string', required: true, description: 'Table id or name' },
} as const

/** Hand-picked from the Airtable Web API reference. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-records',
    method: 'GET',
    path: '/{baseId}/{tableIdOrName}',
    summary: 'List the records of a table, optionally through a view or a formula',
    params: {
      ...BASE_AND_TABLE,
      view: { in: 'query', type: 'string' },
      filterByFormula: { in: 'query', type: 'string' },
      maxRecords: { in: 'query', type: 'integer' },
      pageSize: { in: 'query', type: 'integer', description: 'At most 100' },
      offset: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'offset',
      cursorPath: 'offset',
      itemsPath: 'records',
    },
  },
  {
    name: 'get-record',
    method: 'GET',
    path: '/{baseId}/{tableIdOrName}/{recordId}',
    summary: 'Retrieve one record',
    params: { ...BASE_AND_TABLE, recordId: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'create-records',
    method: 'POST',
    path: '/{baseId}/{tableIdOrName}',
    summary: 'Create up to 10 records',
    params: {
      ...BASE_AND_TABLE,
      records: {
        in: 'body',
        type: 'array',
        required: true,
        description: 'Each item is { fields: { <field name>: <value> } }',
      },
      typecast: { in: 'body', type: 'boolean' },
    },
  },
  {
    name: 'update-records',
    method: 'PATCH',
    path: '/{baseId}/{tableIdOrName}',
    summary: 'Update up to 10 records, only the fields given',
    params: {
      ...BASE_AND_TABLE,
      records: {
        in: 'body',
        type: 'array',
        required: true,
        description: 'Each item is { id, fields }',
      },
      typecast: { in: 'body', type: 'boolean' },
    },
  },
]

/** Airtable's Web API with a personal access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'airtable',
  title: 'Bases and records in Airtable (personal access token)',
  category: 'productivity',
  tags: ['airtable', 'spreadsheet', 'database', 'records', 'bases', 'migration'],
  description:
    'Authenticated calls to the Airtable Web API with a personal access token, with operations to list, read, create and update records.',
  notes: [
    'Create a personal access token in Airtable under Builder Hub, Personal access tokens, with the `data.records:read` and `data.records:write` scopes and access to the bases your automations use, and set it as the environment variable.',
    '`list-records` pages by cursor: call it with `paginate: all` to read the whole table, which is also the first step of moving a base into Sovrium. `create-records` and `update-records` take at most 10 records per call.',
  ],
  params: [],
  env: ['AIRTABLE_TOKEN'],
  requires: [],
  provider: {
    name: 'Airtable',
    docsUrl: 'https://airtable.com/developers/web/api/authentication',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Airtable',
    description: 'Airtable Web API, authenticated with a personal access token',
    props: { token: '$env.AIRTABLE_TOKEN' },
    baseUrl: 'https://api.airtable.com/v0',
    operations: OPERATIONS,
  }),
})
