/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** A curated subset of Microsoft Graph: mail, calendar, files, users and Teams. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-me',
    method: 'GET',
    path: '/me',
    summary: 'Retrieve the profile of the connected user',
  },
  {
    name: 'send-mail',
    method: 'POST',
    path: '/me/sendMail',
    summary: 'Send an email from the connected mailbox',
    params: {
      message: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ subject, body: { contentType, content }, toRecipients }',
      },
      saveToSentItems: { in: 'body', type: 'boolean' },
    },
  },
  {
    name: 'list-messages',
    method: 'GET',
    path: '/me/messages',
    summary: 'List the messages of the connected mailbox',
    params: {
      $top: { in: 'query', type: 'integer' },
      $filter: { in: 'query', type: 'string' },
      $select: { in: 'query', type: 'string' },
    },
  },
  {
    name: 'list-events',
    method: 'GET',
    path: '/me/events',
    summary: 'List the events of the connected calendar',
    params: {
      $top: { in: 'query', type: 'integer' },
      $filter: { in: 'query', type: 'string' },
    },
  },
  {
    name: 'create-event',
    method: 'POST',
    path: '/me/events',
    summary: 'Create an event in the connected calendar',
    params: {
      subject: { in: 'body', type: 'string', required: true },
      body: { in: 'body', type: 'object' },
      start: { in: 'body', type: 'object', required: true, description: '{ dateTime, timeZone }' },
      end: { in: 'body', type: 'object', required: true, description: '{ dateTime, timeZone }' },
      attendees: { in: 'body', type: 'array' },
    },
  },
  {
    name: 'list-drive-items',
    method: 'GET',
    path: '/me/drive/root/children',
    summary: 'List the files at the root of the connected OneDrive',
  },
  {
    name: 'list-users',
    method: 'GET',
    path: '/users',
    summary: 'List the users of the organization',
    params: {
      $top: { in: 'query', type: 'integer' },
      $filter: { in: 'query', type: 'string' },
    },
  },
  {
    name: 'post-channel-message',
    method: 'POST',
    path: '/teams/{team_id}/channels/{channel_id}/messages',
    summary: 'Post a message to a Teams channel',
    params: {
      team_id: { in: 'path', type: 'string', required: true },
      channel_id: { in: 'path', type: 'string', required: true },
      body: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ contentType: text or html, content }',
      },
    },
  },
]

/** Microsoft Graph with OAuth, the provider shorthand supplying Microsoft's endpoints. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'microsoft-365',
  title: 'Microsoft 365: Outlook, Calendar, OneDrive, Teams (OAuth)',
  category: 'productivity',
  tags: ['microsoft', 'outlook', 'teams', 'onedrive', 'graph', 'office', 'oauth'],
  description:
    'A Microsoft 365 account connected with OAuth, with a curated set of Microsoft Graph operations for mail, calendar, files, users and Teams.',
  notes: [
    'Register an application in Microsoft Entra ID, add a Web redirect URI with the one `sovrium library add` prints, create a client secret, and grant the delegated permissions the operations use: Mail.Send, Mail.Read, Calendars.ReadWrite, Files.Read, User.Read.All and ChannelMessage.Send. Set the client id and secret as environment variables and connect the account from your app once.',
    'The `offline_access` scope makes Microsoft return a refresh token, so Sovrium renews the access token itself. Reading every user and posting to Teams may need an administrator of the tenant to consent once for the organization.',
  ],
  params: [],
  env: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Microsoft Graph',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Microsoft 365',
    description: 'Microsoft Graph, connected with OAuth',
    props: {
      provider: 'microsoft',
      clientId: '$env.MICROSOFT_CLIENT_ID',
      clientSecret: '$env.MICROSOFT_CLIENT_SECRET',
      scopes: [
        'offline_access',
        'User.Read',
        'Mail.Send',
        'Mail.Read',
        'Calendars.ReadWrite',
        'Files.Read',
        'User.Read.All',
        'ChannelMessage.Send',
      ],
      pkce: 'S256',
    },
    baseUrl: 'https://graph.microsoft.com/v1.0',
    operations: OPERATIONS,
  }),
})
