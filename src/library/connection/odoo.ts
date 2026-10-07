/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Odoo's JSON-2 API: every model method is `POST /json/2/<model>/<method>`
 * with a bearer API key, and the body carries the method's arguments by name.
 * Three generic methods cover reading, creating and updating any model.
 */
const DATABASE = {
  in: 'header',
  type: 'string',
  description: 'The database to use, when the server hosts more than one',
} as const

const OPERATIONS: LibraryOperations = [
  {
    name: 'search-read',
    method: 'POST',
    path: '/json/2/{model}/search_read',
    summary: 'Read the records of a model matching a domain',
    params: {
      model: { in: 'path', type: 'string', required: true, description: 'e.g. res.partner' },
      'X-Odoo-Database': DATABASE,
      domain: { in: 'body', type: 'array', description: 'e.g. [["is_company", "=", true]]' },
      fields: { in: 'body', type: 'array', items: { type: 'string' } },
      limit: { in: 'body', type: 'integer' },
      offset: { in: 'body', type: 'integer' },
      order: { in: 'body', type: 'string' },
      context: { in: 'body', type: 'object' },
    },
  },
  {
    name: 'create',
    method: 'POST',
    path: '/json/2/{model}/create',
    summary: 'Create records of a model; returns their ids',
    params: {
      model: { in: 'path', type: 'string', required: true, description: 'e.g. crm.lead' },
      'X-Odoo-Database': DATABASE,
      vals_list: {
        in: 'body',
        type: 'array',
        required: true,
        description: 'One object of field values per record',
      },
      context: { in: 'body', type: 'object' },
    },
  },
  {
    name: 'write',
    method: 'POST',
    path: '/json/2/{model}/write',
    summary: 'Update records of a model by id',
    params: {
      model: { in: 'path', type: 'string', required: true },
      'X-Odoo-Database': DATABASE,
      ids: { in: 'body', type: 'array', required: true, items: { type: 'integer' } },
      vals: { in: 'body', type: 'object', required: true, description: 'The field values to set' },
      context: { in: 'body', type: 'object' },
    },
  },
]

/** Odoo through its JSON-2 API, authenticated with a user's API key. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'odoo',
  title: 'ERP with Odoo (API key, JSON-2 API)',
  category: 'finance',
  tags: ['odoo', 'erp', 'crm', 'invoicing', 'inventory', 'accounting'],
  description:
    'Authenticated calls to the JSON-2 API of an Odoo database, with operations to read, create and update the records of any model.',
  notes: [
    "The JSON-2 API ships with Odoo 19 and later. In Odoo, open your user preferences, Account security, and create an API key; the calls run with that user's access rights, so prefer a dedicated user. Set `ODOO_URL` to the address of your Odoo, such as `https://mycompany.odoo.com`, and the key as `ODOO_API_KEY`. On Odoo Online the external API requires a plan that includes it.",
    "Each operation names the technical model in `model` — `res.partner` for contacts, `crm.lead` for leads, `account.move` for invoices — and takes the method's arguments by name. Pass `X-Odoo-Database` when the server hosts several databases. Odoo versions before 19 offer only the older XML-RPC and JSON-RPC endpoints, which carry the password inside the request body and cannot be declared as a connection.",
  ],
  params: [],
  env: ['ODOO_URL', 'ODOO_API_KEY'],
  requires: [],
  provider: {
    name: 'Odoo',
    docsUrl: 'https://www.odoo.com/documentation/19.0/developer/reference/external_api.html',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Odoo',
    description: 'Odoo JSON-2 API, authenticated with an API key',
    props: { token: '$env.ODOO_API_KEY' },
    baseUrl: '$env.ODOO_URL',
    operations: OPERATIONS,
  }),
})
