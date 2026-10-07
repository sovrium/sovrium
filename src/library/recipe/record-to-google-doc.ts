/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record gets its own Google Docs document, copied from a template
 * the operator prepared and shared with the person the record names — two
 * Drive operations of the Google connection, so no file is uploaded.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-google-doc',
  title: 'Create a Google Docs document from a template for each new record',
  category: 'productivity',
  tags: ['google', 'docs', 'drive', 'document', 'template', 'record'],
  description:
    'An automation that copies a Google Docs template for each record created in one of your tables, names it after the record and shares it with the email the record holds.',
  notes: [
    "The automation runs when a record is created in the table named by `table`. It copies the document `templateId` through the `copy-file` operation of the `google` connection, which is installed with it, names the copy after the record's `titleField`, then gives the address in its `emailField` the `role` access through `share-file`. Google emails that person a link.",
    "The template id is the long part of the document's address, between `/d/` and `/edit`. Share the template with the connected Google account first, since the connection only reaches files the app created or that were shared with it. Filling the copy's placeholders is a further `http` step to the Docs API with the same connection.",
  ],
  params: [
    {
      name: 'templateId',
      description: 'The id of the Google Docs document to copy.',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table whose new records each get a document.',
      type: 'string',
      default: 'clients',
    },
    {
      name: 'titleField',
      description: 'The field the copy is named after.',
      type: 'string',
      default: 'name',
    },
    {
      name: 'emailField',
      description: 'The field holding the email the copy is shared with.',
      type: 'string',
      default: 'email',
    },
    {
      name: 'role',
      description: 'The access given: reader, commenter or writer.',
      type: 'string',
      default: 'writer',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'titleField', type: 'single-line-text' },
        { name: 'email', param: 'emailField', type: 'email' },
      ],
    },
  ],
  env: [],
  requires: ['connection/google'],
  provider: {
    name: 'Google Drive',
    docsUrl: 'https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => {
    const titleField = String(params['titleField'] ?? 'name')
    const emailField = String(params['emailField'] ?? 'email')
    return {
      name,
      trigger: { type: 'record', table: String(params['table'] ?? 'clients'), events: ['create'] },
      actions: [
        {
          name: 'copy',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'google',
            operation: 'copy-file',
            params: {
              fileId: String(params['templateId'] ?? ''),
              name: `{{trigger.data.record.${titleField}}}`,
            },
          },
        },
        {
          name: 'share',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'google',
            operation: 'share-file',
            params: {
              fileId: '{{steps.copy.data.id}}',
              role: String(params['role'] ?? 'writer'),
              type: 'user',
              emailAddress: `{{trigger.data.record.${emailField}}}`,
            },
          },
        },
      ],
    }
  },
})
