/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each form submission is appended as a row of a Google Sheets spreadsheet.
 * The Sheets API lives on its own host, so the step is an `http` call made
 * with the Google connection's token rather than one of its operations.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-google-sheets',
  title: 'Append each form submission to a Google Sheets spreadsheet',
  category: 'productivity',
  tags: ['google', 'sheets', 'spreadsheet', 'form', 'export'],
  description:
    'An automation that appends one row per submission of one of your forms to a Google Sheets spreadsheet.',
  notes: [
    'The automation runs when the form named by `form` is submitted and appends one row to the spreadsheet `spreadsheetId`, after the last filled row of `range`, with the values of the form fields listed in `fields`, in that order. It calls the Sheets API with the token of the `google` connection, which is installed with it.',
    'The spreadsheet id is the long part of its address, between `/d/` and `/edit`. Values are entered as if typed, so a date or a number is recognised by Sheets.',
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions are appended, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'spreadsheetId',
      description: 'The id of the spreadsheet to append to.',
      type: 'string',
      required: true,
    },
    {
      name: 'range',
      description: 'The sheet and range whose last row is extended, in A1 notation.',
      type: 'string',
      default: 'Sheet1!A1',
    },
    {
      name: 'fields',
      description: 'The form fields to write, comma-separated, one per column.',
      type: 'string',
      default: 'email',
    },
  ],
  env: [],
  requires: ['connection/google'],
  provider: {
    name: 'Google Sheets',
    docsUrl:
      'https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const columns = String(params['fields'] ?? 'email')
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field !== '')
    const sheet = encodeURIComponent(String(params['range'] ?? 'Sheet1!A1'))
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'appendRow',
          type: 'http',
          operator: 'post',
          props: {
            url: `https://sheets.googleapis.com/v4/spreadsheets/${String(params['spreadsheetId'] ?? '')}/values/${sheet}:append?valueInputOption=USER_ENTERED`,
            connection: 'google',
            contentType: 'json',
            body: { values: [columns.map((field) => `{{trigger.data.${field}}}`)] },
          },
        },
      ],
    }
  },
})
