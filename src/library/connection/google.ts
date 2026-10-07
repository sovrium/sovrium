/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * A curated subset — Calendar, Drive, Docs and Gmail — on the host they share.
 * The Sheets and Docs APIs live on their own hosts (`sheets.googleapis.com`,
 * `docs.googleapis.com`), so a recipe that writes a spreadsheet or edits the
 * body of a document calls them with an `http` step through this connection's
 * token. A Google Docs document is still created, copied, shared and read as a
 * Drive file, which is what the Drive operations below do.
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
    name: 'create-file',
    method: 'POST',
    path: '/drive/v3/files',
    summary: 'Create a Drive file from its metadata, such as an empty Google Docs document',
    params: {
      name: { in: 'body', type: 'string', required: true },
      mimeType: {
        in: 'body',
        type: 'string',
        description: 'application/vnd.google-apps.document for a Google Docs document',
      },
      parents: { in: 'body', type: 'array', items: { type: 'string' }, description: 'Folder ids' },
      description: { in: 'body', type: 'string' },
    },
  },
  {
    name: 'copy-file',
    method: 'POST',
    path: '/drive/v3/files/{fileId}/copy',
    summary: 'Copy a Drive file, for example a template document, under a new name',
    params: {
      fileId: { in: 'path', type: 'string', required: true },
      name: { in: 'body', type: 'string' },
      parents: { in: 'body', type: 'array', items: { type: 'string' }, description: 'Folder ids' },
    },
  },
  {
    name: 'share-file',
    method: 'POST',
    path: '/drive/v3/files/{fileId}/permissions',
    summary: 'Share a Drive file with a person, a group, a domain or anyone with the link',
    params: {
      fileId: { in: 'path', type: 'string', required: true },
      role: {
        in: 'body',
        type: 'string',
        required: true,
        enum: ['reader', 'commenter', 'writer', 'fileOrganizer', 'organizer', 'owner'],
      },
      type: {
        in: 'body',
        type: 'string',
        required: true,
        enum: ['user', 'group', 'domain', 'anyone'],
      },
      emailAddress: { in: 'body', type: 'string', format: 'email' },
      domain: { in: 'body', type: 'string' },
      sendNotificationEmail: { in: 'query', type: 'boolean' },
    },
  },
  {
    name: 'upload-file',
    method: 'POST',
    path: '/upload/drive/v3/files?uploadType=multipart',
    summary: "Upload a file's bytes to Drive with its name, type and folder, in one request",
    params: {
      name: { in: 'body', type: 'string', required: true },
      mimeType: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'Media type of the file, such as application/pdf',
      },
      parents: {
        in: 'body',
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'Folder ids; pass ["root"] for the top of My Drive',
      },
      file: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'The file to upload: a storage key, a data: URI or an https:// URL',
      },
    },
    body: {
      kind: 'multipart-related',
      parts: [
        {
          contentType: 'application/json; charset=UTF-8',
          content:
            '{"name": {{params.name}}, "mimeType": {{params.mimeType}}, "parents": {{params.parents}}}',
        },
        { contentType: '{{params.mimeType}}', file: '{{params.file}}' },
      ],
    },
  },
  {
    name: 'export-file',
    method: 'GET',
    path: '/drive/v3/files/{fileId}/export',
    summary: 'Read a Google Docs, Sheets or Slides file converted to another format',
    params: {
      fileId: { in: 'path', type: 'string', required: true },
      mimeType: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'text/plain or text/html for a document, text/csv for a sheet',
      },
    },
  },
  {
    name: 'list-messages',
    method: 'GET',
    path: '/gmail/v1/users/{userId}/messages',
    summary: 'List the messages of the connected Gmail account, optionally matching a search',
    params: {
      userId: { in: 'path', type: 'string', required: true, description: 'me for the account' },
      q: { in: 'query', type: 'string', description: 'Gmail search, as typed in the search box' },
      maxResults: { in: 'query', type: 'integer' },
      pageToken: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'pageToken',
      cursorPath: 'nextPageToken',
      itemsPath: 'messages',
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
  title: 'Google Workspace: Calendar, Drive, Docs, Gmail, Sheets (OAuth)',
  category: 'productivity',
  tags: ['google', 'gmail', 'calendar', 'drive', 'docs', 'sheets', 'workspace', 'oauth'],
  description:
    'A Google account connected with OAuth, with operations for Calendar, Drive, Docs and Gmail, and a token that also reaches the Sheets and Docs APIs.',
  notes: [
    'Create an OAuth client of type Web application in the Google Cloud console for your project, enable the Calendar, Drive, Docs, Gmail and Sheets APIs, and register the redirect URI `sovrium library add` prints. Set the client id and secret as environment variables, then connect the account from your app once.',
    'The connection asks for offline access so Sovrium receives a refresh token and renews the access token itself. It requests the scopes for calendar events, the Drive files the app creates or opens, sending and reading mail, and spreadsheets; remove the ones you do not use from `scopes`. Google reviews apps that request Gmail scopes before other people than your test users can connect, and reading mail is a restricted scope with a stricter review: drop `gmail.readonly` if you only send.',
    "A Google Docs document is a Drive file. `create-file` with the document type creates an empty one, `copy-file` duplicates a template you prepared, `share-file` gives a person access, and `export-file` reads it back as plain text or HTML. `upload-file` sends a file's bytes with its name, type and folder in one multipart request, reading the file the way the `file` actions do: a storage key, a `data:` URI or an `https://` URL. With the `drive.file` scope these reach the files the app created or that were opened with it, so copy a template that was shared with the connected account.",
  ],
  params: [],
  env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Google',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2/web-server',
    verifiedOn: '2026-10-06',
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
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
      pkce: 'S256',
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
    baseUrl: 'https://www.googleapis.com',
    operations: OPERATIONS,
  }),
})
