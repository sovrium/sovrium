/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * A curated subset — Calendar, Drive and Gmail — on the host they share. The
 * Sheets API lives on another host (`sheets.googleapis.com`), so a recipe that
 * writes to a spreadsheet calls it with an `http` step through this
 * connection's token instead of an operation.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-events',
    method: 'GET',
    path: '/calendar/v3/calendars/{calendarId}/events',
    summary: 'List the events of a calendar',
    params: {
      calendarId: { in: 'path', type: 'string', required: true, description: 'primary for yours' },
      timeMin: { in: 'query', type: 'string', format: 'date-time' },
      timeMax: { in: 'query', type: 'string', format: 'date-time' },
      singleEvents: { in: 'query', type: 'boolean' },
      orderBy: { in: 'query', type: 'string', enum: ['startTime', 'updated'] },
      pageToken: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'pageToken',
      cursorPath: 'nextPageToken',
      itemsPath: 'items',
    },
  },
  {
    name: 'create-event',
    method: 'POST',
    path: '/calendar/v3/calendars/{calendarId}/events',
    summary: 'Create an event in a calendar',
    params: {
      calendarId: { in: 'path', type: 'string', required: true },
      summary: { in: 'body', type: 'string' },
      description: { in: 'body', type: 'string' },
      start: { in: 'body', type: 'object', required: true, description: '{ dateTime, timeZone }' },
      end: { in: 'body', type: 'object', required: true, description: '{ dateTime, timeZone }' },
      attendees: { in: 'body', type: 'array', description: 'Items { email }' },
    },
  },
  {
    name: 'list-files',
    method: 'GET',
    path: '/drive/v3/files',
    summary: 'List or search the Drive files the app can see',
    params: {
      q: { in: 'query', type: 'string', description: 'Drive search query' },
      pageSize: { in: 'query', type: 'integer' },
      pageToken: { in: 'query', type: 'string' },
      fields: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'pageToken',
      cursorPath: 'nextPageToken',
      itemsPath: 'files',
    },
  },
  {
    name: 'send-email',
    method: 'POST',
    path: '/gmail/v1/users/{userId}/messages/send',
    summary: 'Send an email from the connected Gmail account',
    params: {
      userId: { in: 'path', type: 'string', required: true, description: 'me for the account' },
      raw: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'The whole RFC 2822 message, base64url-encoded',
      },
    },
  },
]

/** Google APIs with OAuth, the provider shorthand supplying Google's endpoints. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'google',
  title: 'Google Workspace: Calendar, Drive, Gmail, Sheets (OAuth)',
  category: 'productivity',
  tags: ['google', 'gmail', 'calendar', 'drive', 'sheets', 'workspace', 'oauth'],
  description:
    'A Google account connected with OAuth, with operations for Calendar, Drive and Gmail, and a token that also reaches the Sheets API.',
  notes: [
    'Create an OAuth client of type Web application in the Google Cloud console for your project, enable the Calendar, Drive, Gmail and Sheets APIs, and register the redirect URI `sovrium library add` prints. Set the client id and secret as environment variables, then connect the account from your app once.',
    'The connection asks for offline access so Sovrium receives a refresh token and renews the access token itself. It requests the scopes for calendar events, the Drive files the app creates or opens, sending mail and spreadsheets; remove the ones you do not use from `scopes`. Google reviews apps that request Gmail scopes before other people than your test users can connect.',
  ],
  params: [],
  env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Google',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2/web-server',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Google',
    description: 'Google APIs, connected with OAuth',
    props: {
      provider: 'google',
      clientId: '$env.GOOGLE_CLIENT_ID',
      clientSecret: '$env.GOOGLE_CLIENT_SECRET',
      scopes: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
      pkce: 'S256',
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
    baseUrl: 'https://www.googleapis.com',
    operations: OPERATIONS,
  }),
})
