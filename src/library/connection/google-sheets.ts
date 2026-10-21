/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Values of the Sheets API v4, on its own host. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-sheet-values',
    method: 'GET',
    path: '/v4/spreadsheets/{spreadsheetId}/values/{range}',
    summary: 'Read the cells of a range, row by row',
    params: {
      spreadsheetId: {
        in: 'path',
        type: 'string',
        required: true,
        description: 'The id in the sheet address',
      },
      range: {
        in: 'path',
        type: 'string',
        required: true,
        description: 'A1 notation, such as Donations!A2:F',
      },
      majorDimension: { in: 'query', type: 'string', enum: ['ROWS', 'COLUMNS'] },
      valueRenderOption: {
        in: 'query',
        type: 'string',
        enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
      },
      dateTimeRenderOption: {
        in: 'query',
        type: 'string',
        enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'],
      },
    },
  },
  {
    name: 'append-sheet-values',
    method: 'POST',
    path: '/v4/spreadsheets/{spreadsheetId}/values/{range}:append',
    summary: 'Add rows after the last row of the table found in a range',
    params: {
      spreadsheetId: { in: 'path', type: 'string', required: true },
      range: {
        in: 'path',
        type: 'string',
        required: true,
        description: 'A1 notation of the table, such as Donations!A:F',
      },
      valueInputOption: {
        in: 'query',
        type: 'string',
        required: true,
        enum: ['RAW', 'USER_ENTERED'],
      },
      insertDataOption: { in: 'query', type: 'string', enum: ['OVERWRITE', 'INSERT_ROWS'] },
      includeValuesInResponse: { in: 'query', type: 'boolean' },
      values: {
        in: 'body',
        type: 'array',
        required: true,
        description: 'The rows to add, each an array of cell values',
      },
    },
  },
]

/**
 * Google Sheets with the Google OAuth client. The Sheets API is served only on
 * sheets.googleapis.com, which the google connection's base URL cannot reach,
 * so it is its own connection on the same client id and secret.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'google-sheets',
  title: 'Google Sheets rows (OAuth)',
  category: 'productivity',
  tags: ['google', 'sheets', 'spreadsheet', 'rows', 'workspace', 'oauth'],
  description:
    'A Google account connected with OAuth to the Sheets API, with operations to read a range and to append rows.',
  notes: [
    'Uses the same OAuth client as the `google` connection: enable the Sheets API in the Google Cloud console for that project, register the redirect URI `sovrium library add` prints, and connect the account from your app once. It is a separate connection because Google serves the Sheets API on its own address.',
    'Sheets sends no event when a row is added, so new rows are read on a schedule: run `get-sheet-values` on the table range from an automation with a `cron` trigger, and keep only the rows past the last row count it saw. `append-sheet-values` adds rows after the table, with `valueInputOption: USER_ENTERED` to have them read as if typed.',
  ],
  params: [],
  env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Google',
    docsUrl:
      'https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Google Sheets',
    description: 'Google Sheets API, connected with OAuth',
    props: {
      provider: 'google',
      clientId: '$env.GOOGLE_CLIENT_ID',
      clientSecret: '$env.GOOGLE_CLIENT_SECRET',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      pkce: 'S256',
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    },
    baseUrl: 'https://sheets.googleapis.com',
    operations: OPERATIONS,
  }),
})
