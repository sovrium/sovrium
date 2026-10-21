/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Files on Dropbox's content host: upload and download, by path. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'upload-file',
    method: 'POST',
    path: '/2/files/upload',
    summary: 'Upload a file of up to 150 MiB to a path in Dropbox',
    params: {
      'Dropbox-API-Arg': {
        in: 'header',
        type: 'string',
        required: true,
        description:
          'The call arguments as JSON, such as {"path": "/Invoices/42.pdf", "mode": "add"}',
      },
      file: {
        in: 'body',
        type: 'file',
        required: true,
        description: 'The file sent: a storage key, a data: URI or an https:// URL',
      },
    },
    body: { kind: 'raw', contentType: 'application/octet-stream', file: '{{params.file}}' },
  },
  {
    name: 'download-file',
    method: 'POST',
    path: '/2/files/download',
    summary: 'Download a file from a path in Dropbox',
    params: {
      'Dropbox-API-Arg': {
        in: 'header',
        type: 'string',
        required: true,
        description: 'The call arguments as JSON, such as {"path": "/Invoices/42.pdf"}',
      },
    },
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'dropbox',
  title: 'Dropbox files (OAuth)',
  category: 'documents',
  tags: ['dropbox', 'files', 'storage', 'upload', 'documents'],
  description:
    'Dropbox connected with OAuth, with operations to upload and download files by path.',
  notes: [
    'Create an app in the Dropbox App Console with the files.content.write and files.content.read scopes, register the redirect URI Sovrium prints, and set the app key and secret as `DROPBOX_CLIENT_ID` and `DROPBOX_CLIENT_SECRET`. The connection asks for offline access, so the account stays connected.',
    'Both operations take their arguments as JSON in the `Dropbox-API-Arg` header, for instance `{"path": "/Invoices/42.pdf", "mode": "add"}`; write any character outside ASCII as a `\\uXXXX` escape.',
    'Uploads and downloads live on content.dropboxapi.com. The other Dropbox endpoints, such as creating a folder or listing one, live on api.dropboxapi.com: call those with an `http` step authenticated by this connection.',
  ],
  params: [],
  env: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Dropbox',
    docsUrl: 'https://docs.dropboxapi.com/dropbox-api/docs/get-started/authorization',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Dropbox',
    description: 'Dropbox API, connected with OAuth',
    props: {
      authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      clientId: '$env.DROPBOX_CLIENT_ID',
      clientSecret: '$env.DROPBOX_CLIENT_SECRET',
      scopes: ['files.content.write', 'files.content.read'],
      pkce: 'S256',
      extraAuthParams: { token_access_type: 'offline' },
    },
    baseUrl: 'https://content.dropboxapi.com',
    operations: OPERATIONS,
  }),
})
