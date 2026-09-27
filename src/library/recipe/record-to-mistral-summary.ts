/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record gets a short summary of one of its text fields, written back
 * into another field by a Mistral model. The automation listens to `create`
 * only, so writing the summary does not fire it again.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-mistral-summary',
  title: 'Summarise each new record with Mistral',
  category: 'ai',
  tags: ['mistral', 'ai', 'summary', 'record', 'llm'],
  description:
    'An automation that asks a Mistral model to summarise a text field of each new record and writes the summary into another field of that record.',
  notes: [
    'The automation runs when a record is created in the table named by `table`, sends the value of `sourceField` to the model `model` through the `chat-completion` operation of the `mistral` connection, which is installed with it, and writes the answer into `summaryField` of the same record.',
    'It runs on creation only, so the write-back does not trigger it again. Change the instruction the model follows in the `system` message of the installed step; every call is billed by Mistral for the tokens it reads and writes.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table whose new records are summarised.',
      type: 'string',
      default: 'notes',
    },
    {
      name: 'sourceField',
      description: 'The field holding the text to summarise.',
      type: 'string',
      default: 'body',
    },
    {
      name: 'summaryField',
      description: 'The field the summary is written into.',
      type: 'string',
      default: 'summary',
    },
    {
      name: 'model',
      description: 'The Mistral model to use.',
      type: 'string',
      default: 'mistral-small-latest',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'body', param: 'sourceField', type: 'long-text' },
        { name: 'summary', param: 'summaryField', type: 'long-text' },
      ],
    },
  ],
  env: [],
  requires: ['connection/mistral'],
  provider: {
    name: 'Mistral AI',
    docsUrl: 'https://docs.mistral.ai/api/',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const table = String(params['table'] ?? 'notes')
    return {
      name,
      trigger: { type: 'record', table, events: ['create'] },
      actions: [
        {
          name: 'summarize',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'mistral',
            operation: 'chat-completion',
            params: {
              model: String(params['model'] ?? 'mistral-small-latest'),
              messages: [
                {
                  role: 'system',
                  content:
                    'Summarise the text you are given in at most two sentences, in the language it is written in.',
                },
                {
                  role: 'user',
                  content: `{{trigger.data.record.${String(params['sourceField'] ?? 'body')}}}`,
                },
              ],
            },
          },
        },
        {
          name: 'saveSummary',
          type: 'record',
          operator: 'update',
          props: {
            table,
            filter: {
              conditions: [
                { field: 'id', operator: 'equals', value: '{{trigger.data.record.id}}' },
              ],
            },
            data: {
              [String(params['summaryField'] ?? 'summary')]:
                '{{steps.summarize.data.choices.0.message.content}}',
            },
          },
        },
      ],
    }
  },
})
