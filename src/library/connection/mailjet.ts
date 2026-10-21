/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Mailjet's Send API v3.1 and the v3 REST contact resources. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'send-email',
    method: 'POST',
    path: '/v3.1/send',
    summary: 'Send one or more messages, from a stored template or from their own content',
    params: {
      Messages: {
        in: 'body',
        type: 'array',
        required: true,
        description:
          'Each message: From, To, and either TemplateID with TemplateLanguage true and Variables, or Subject with TextPart or HTMLPart',
      },
      Globals: { in: 'body', type: 'object', description: 'Properties applied to every message' },
      SandboxMode: {
        in: 'body',
        type: 'boolean',
        description: 'Check the payload without delivering anything',
      },
    },
  },
  {
    name: 'create-contact',
    method: 'POST',
    path: '/v3/REST/contact',
    summary: 'Create a contact',
    params: {
      Email: { in: 'body', type: 'string', required: true, format: 'email' },
      Name: { in: 'body', type: 'string' },
      IsExcludedFromCampaigns: { in: 'body', type: 'boolean' },
    },
  },
  {
    name: 'manage-contact-lists',
    method: 'POST',
    path: '/v3/REST/contact/{contact_ID}/managecontactslists',
    summary: 'Subscribe a contact to lists, or remove or unsubscribe it from them',
    params: {
      contact_ID: {
        in: 'path',
        type: 'string',
        required: true,
        description: 'The contact ID or email',
      },
      ContactsLists: {
        in: 'body',
        type: 'array',
        required: true,
        description: 'Each item: ListID, and Action one of addforce, addnoforce, remove, unsub',
      },
    },
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'mailjet',
  title: 'Transactional email with Mailjet (API key)',
  category: 'marketing',
  tags: ['mailjet', 'email', 'transactional', 'templates', 'contacts'],
  description:
    'Authenticated calls to Mailjet, with operations to send emails from stored templates and to manage contacts and their lists.',
  notes: [
    'Copy the API key and the secret key from your Mailjet account and set them as `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`. They are sent as the user and password of Basic authentication.',
    'A template stays in Mailjet: `send-email` names it by `TemplateID`, sets `TemplateLanguage` to true and passes its values in `Variables`, which the template reads as `{{var:name}}`. Set `SandboxMode` to true to check a payload without sending it.',
  ],
  params: [],
  env: ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY'],
  requires: [],
  provider: {
    name: 'Mailjet',
    docsUrl: 'https://dev.mailjet.com/docs/email-api/send-api-v31/use-template',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Mailjet',
    description: 'Mailjet API, authenticated with an API key and a secret key',
    props: { username: '$env.MAILJET_API_KEY', password: '$env.MAILJET_SECRET_KEY' },
    baseUrl: 'https://api.mailjet.com',
    operations: OPERATIONS,
  }),
})
