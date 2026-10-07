/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record of one of the operator's tables is announced in a Microsoft
 * Teams channel, through the Teams operation of the Microsoft 365 connection.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-teams-channel',
  title: 'Post each new record to a Microsoft Teams channel',
  category: 'communication',
  tags: ['microsoft', 'teams', 'record', 'notification', 'channel'],
  description:
    'An automation that posts a message to a Microsoft Teams channel each time a record is created in one of your tables.',
  notes: [
    'The automation runs when a record is created in the table named by `table` and posts the value of its `titleField` to the channel `channelId` of the team `teamId`, through the `post-channel-message` operation of the `microsoft-365` connection, which is installed with it. The message is posted as the connected user.',
    "Find both ids with the `list-joined-teams` and `list-channels` operations, or from a channel's link in Teams: the team id is its `groupId` and the channel id the part after `/channel/`, decoded. Edit the `content` of the installed step to quote more fields, with `{{trigger.data.record.<field>}}`.",
  ],
  params: [
    {
      name: 'teamId',
      description: 'The id of the team the channel belongs to.',
      type: 'string',
      required: true,
    },
    {
      name: 'channelId',
      description: 'The id of the channel to post to.',
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
  requires: ['connection/microsoft-365'],
  provider: {
    name: 'Microsoft Graph',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/chatmessage-post?view=graph-rest-1.0',
    verifiedOn: '2026-10-06',
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
            connection: 'microsoft-365',
            operation: 'post-channel-message',
            params: {
              team_id: String(params['teamId'] ?? ''),
              channel_id: String(params['channelId'] ?? ''),
              body: {
                contentType: 'text',
                content: `New in ${table}: {{trigger.data.record.${titleField}}}`,
              },
            },
          },
        },
      ],
    }
  },
})
