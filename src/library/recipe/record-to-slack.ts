/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record of one of the operator's tables is announced in a Slack
 * channel, through the `post-message` operation of the Slack connection.
 *
 * The table and the field quoted in the message are PARAMETERS, declared in
 * `tables`, so the recipe binds to the operator's own table rather than
 * shipping one — and `library add` refuses by name when that table or field is
 * missing, before anything is written.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-slack',
  title: 'Post each new record to a Slack channel',
  category: 'communication',
  tags: ['slack', 'record', 'notification', 'channel', 'alert'],
  description:
    'An automation that posts a message to a Slack channel each time a record is created in one of your tables.',
  notes: [
    'The automation runs when a record is created in the table named by `table`, and posts the value of its `titleField` field to the channel named by `channel`, through the `post-message` operation of the `slack` connection, which is installed with it.',
    'Point it at your own table and field with `--set table=<your table> --set titleField=<your field>`. Edit the `text` of the installed step to quote more fields, with `{{trigger.data.record.<field>}}`.',
  ],
  params: [
    {
      name: 'channel',
      description: 'The Slack channel to post to, by id or name (the bot must be a member).',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table whose new records are announced.',
      type: 'string',
      default: 'tasks',
    },
    {
      name: 'titleField',
      description: 'The field quoted in the message.',
      type: 'string',
      default: 'title',
    },
  ],
  tables: [
    { param: 'table', fields: [{ name: 'title', param: 'titleField', type: 'single-line-text' }] },
  ],
  env: [],
  requires: ['connection/slack'],
  provider: {
    name: 'Slack',
    docsUrl: 'https://docs.slack.dev/reference/methods/chat.postMessage',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const table = String(params['table'] ?? 'tasks')
    const titleField = String(params['titleField'] ?? 'title')
    return {
      name,
      trigger: { type: 'record', table, events: ['create'] },
      actions: [
        {
          name: 'announce',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'slack',
            operation: 'post-message',
            params: {
              channel: String(params['channel'] ?? ''),
              text: `New in ${table}: {{trigger.data.record.${titleField}}}`,
            },
          },
        },
      ],
    }
  },
})
