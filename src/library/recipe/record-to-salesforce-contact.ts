/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each record created or changed in one of the operator's tables is upserted
 * as a Salesforce contact, keyed by the record id in an External ID field —
 * so a record edited twice updates one contact instead of creating two.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-salesforce-contact',
  title: 'Keep a Salesforce contact in step with each record',
  category: 'sales',
  tags: ['salesforce', 'crm', 'contact', 'record', 'sync', 'upsert'],
  description:
    'An automation that creates or updates a Salesforce contact each time a record of your table is created or changed.',
  notes: [
    'The automation runs when a record of `table` is created or updated and upserts a contact through the `upsert-contact` operation of the `salesforce` connection, which is installed with it: Salesforce looks the contact up by the record id stored in the External ID field `externalIdField`, updates it when found and creates it otherwise.',
    'Create that External ID field on the Contact object first, in Salesforce Setup (for example a text field named `Sovrium_Id__c`, marked External ID and Unique).',
  ],
  params: [
    {
      name: 'externalIdField',
      description: 'The API name of the External ID field on Contact that holds the record id.',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table whose records are kept in Salesforce.',
      type: 'string',
      default: 'customers',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'first_name', type: 'single-line-text' },
        { name: 'last_name', type: 'single-line-text' },
        { name: 'email', type: 'email' },
      ],
    },
  ],
  env: [],
  requires: ['connection/salesforce'],
  provider: {
    name: 'Salesforce',
    docsUrl:
      'https://trailhead.salesforce.com/content/learn/projects/build-integrations-with-external-client-apps/implement-the-oauth-20-web-server-flow',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'record',
      table: String(params['table'] ?? 'customers'),
      events: ['create', 'update'],
    },
    actions: [
      {
        name: 'upsertContact',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'salesforce',
          operation: 'upsert-contact',
          params: {
            externalIdField: String(params['externalIdField'] ?? ''),
            externalId: '{{trigger.data.record.id}}',
            FirstName: '{{trigger.data.record.first_name}}',
            LastName: '{{trigger.data.record.last_name}}',
            Email: '{{trigger.data.record.email}}',
          },
        },
      },
    ],
  }),
})
