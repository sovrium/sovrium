/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Channels and messages of the Discord API, called as a bot. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-message',
    method: 'POST',
    path: '/channels/{channel_id}/messages',
    summary: 'Post a message in a channel',
    params: {
      channel_id: { in: 'path', type: 'string', required: true },
      content: { in: 'body', type: 'string', description: 'Up to 2,000 characters' },
      embeds: { in: 'body', type: 'array' },
      allowed_mentions: { in: 'body', type: 'object' },
    },
  },
  {
    name: 'list-guild-channels',
    method: 'GET',
    path: '/guilds/{guild_id}/channels',
    summary: 'List the channels of a server',
    params: { guild_id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-channel-messages',
    method: 'GET',
    path: '/channels/{channel_id}/messages',
    summary: 'Read the latest messages of a channel',
    params: {
      channel_id: { in: 'path', type: 'string', required: true },
      limit: { in: 'query', type: 'integer', description: '1 to 100' },
      before: { in: 'query', type: 'string' },
    },
  },
]

/** Discord, authenticated as a bot. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'discord',
  title: 'Community chat with Discord (bot token)',
  category: 'community',
  tags: ['discord', 'chat', 'community', 'bot', 'messages'],
  description:
    'Authenticated calls to the Discord API as a bot, with operations to post and read channel messages.',
  notes: [
    'Create an application in the Discord Developer Portal, add a bot to it, copy the bot token and set it as `DISCORD_BOT_TOKEN`. Invite the bot to your server with the permissions to view channels, send messages and read message history; the connection sends the token as `Authorization: Bot <token>`.',
    "Turn on Developer Mode in Discord's settings to copy a server or channel id with a right click. Reading the text of messages needs the Message Content intent turned on for the bot in the Developer Portal.",
  ],
  params: [],
  env: ['DISCORD_BOT_TOKEN'],
  requires: [],
  provider: {
    name: 'Discord',
    docsUrl: 'https://discord.com/developers/docs/resources/message',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Discord',
    description: 'Discord API, authenticated as a bot',
    props: { key: 'Bot $env.DISCORD_BOT_TOKEN', header: 'Authorization' },
    baseUrl: 'https://discord.com/api/v10',
    operations: OPERATIONS,
  }),
})
