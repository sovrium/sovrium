/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Slack's Web API with a bot token.
 *
 * A bot token is a bearer credential, so no OAuth flow runs inside Sovrium: the
 * operator installs their own Slack app in their workspace once and copies its
 * bot token. The operations are a hand-picked set — Slack publishes no current
 * OpenAPI description — each a method of `https://slack.com/api`.
 */
/** Hand-picked: Slack publishes no current OpenAPI description. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'post-message',
    method: 'POST',
    path: '/chat.postMessage',
    summary: 'Post a message to a channel, a private group or a direct message',
    params: {
      channel: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'Channel id or name',
      },
      text: { in: 'body', type: 'string', description: 'Message text (mrkdwn)' },
      thread_ts: {
        in: 'body',
        type: 'string',
        description: 'Timestamp of the parent message, to reply in its thread',
      },
    },
  },
  {
    name: 'update-message',
    method: 'POST',
    path: '/chat.update',
    summary: 'Replace the text of a message the bot posted',
    params: {
      channel: { in: 'body', type: 'string', required: true, description: 'Channel id' },
      ts: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'Timestamp of the message to update',
      },
      text: { in: 'body', type: 'string', description: 'New message text' },
    },
  },
  {
    name: 'list-channels',
    method: 'GET',
    path: '/conversations.list',
    summary: 'List the channels of the workspace',
    params: {
      types: {
        in: 'query',
        type: 'string',
        description: 'Comma-separated: public_channel, private_channel, mpim, im',
      },
      exclude_archived: { in: 'query', type: 'boolean' },
      limit: { in: 'query', type: 'integer', description: 'At most 1000 per page' },
      cursor: { in: 'query', type: 'string', description: 'Cursor of the next page' },
    },
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'slack',
  title: 'Slack messages with a bot token',
  category: 'communication',
  tags: ['slack', 'chat', 'messages', 'notifications', 'channels'],
  description:
    'Authenticated calls to the Slack Web API with the bot token of your own Slack app, with operations to post and update messages.',
  notes: [
    'Create a Slack app for your workspace, give its bot the `chat:write` scope (and `channels:read` to list channels), install it, and set its bot token (it starts with `xoxb-`) as the environment variable. Invite the bot to each channel it posts in.',
    'Call `post-message`, `update-message` or `list-channels` from a step with `type: connection` and `operator: call`. Slack answers most errors with a 200 status and `ok: false` in the body, so read `steps.<name>.data.ok` when a step must know whether the message was posted.',
  ],
  params: [],
  env: ['SLACK_BOT_TOKEN'],
  requires: [],
  provider: {
    name: 'Slack',
    docsUrl: 'https://docs.slack.dev/reference/methods/chat.postMessage',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Slack',
    description: 'Slack Web API, authenticated with a bot token',
    props: { token: '$env.SLACK_BOT_TOKEN' },
    baseUrl: 'https://slack.com/api',
    operations: OPERATIONS,
  }),
})
