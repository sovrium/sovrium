/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Typeform's webhooks and responses, per form. */
const FORM_ID = { in: 'path', type: 'string', required: true } as const
const OPERATIONS: LibraryOperations = [
  {
    name: 'put-webhook',
    method: 'PUT',
    path: '/forms/{form_id}/webhooks/{tag}',
    summary: "Create or update a form's webhook, which posts each new response to a URL",
    params: {
      form_id: FORM_ID,
      tag: {
        in: 'path',
        type: 'string',
        required: true,
        description: 'A unique name for the webhook',
      },
      url: { in: 'body', type: 'string', required: true, format: 'uri' },
      enabled: { in: 'body', type: 'boolean', required: true },
      secret: { in: 'body', type: 'string', description: 'Signs each payload with HMAC SHA-256' },
      verify_ssl: { in: 'body', type: 'boolean' },
    },
  },
  {
    name: 'list-webhooks',
    method: 'GET',
    path: '/forms/{form_id}/webhooks',
    summary: "List a form's webhooks",
    params: { form_id: FORM_ID },
  },
  {
    name: 'delete-webhook',
    method: 'DELETE',
    path: '/forms/{form_id}/webhooks/{tag}',
    summary: "Delete a form's webhook",
    params: { form_id: FORM_ID, tag: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-responses',
    method: 'GET',
    path: '/forms/{form_id}/responses',
    summary: "List a form's responses, newest first unless sorted otherwise",
    params: {
      form_id: FORM_ID,
      page_size: { in: 'query', type: 'integer' },
      since: { in: 'query', type: 'string', format: 'date-time' },
      until: { in: 'query', type: 'string', format: 'date-time' },
      after: { in: 'query', type: 'string', description: 'A response token to read after' },
      before: { in: 'query', type: 'string', description: 'A response token to read before' },
      completed: { in: 'query', type: 'boolean' },
      sort: { in: 'query', type: 'string' },
      query: { in: 'query', type: 'string' },
      fields: { in: 'query', type: 'string' },
    },
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'typeform',
  title: 'Typeform webhooks (personal token)',
  category: 'productivity',
  tags: ['typeform', 'forms', 'surveys', 'webhooks', 'responses'],
  description:
    'Authenticated calls to the Typeform API, with operations to register form webhooks and to read responses. An account in the EU Data Center answers on api.eu.typeform.com or api.typeform.eu instead.',
  notes: [
    'Create a personal access token in your Typeform account, with the scopes the operations you call need, and set it as `TYPEFORM_TOKEN`.',
    'To receive each new response, give an automation a `webhook` trigger and call `put-webhook` once with its URL. A form keeps one webhook per `tag`.',
    'An account whose responses are stored in the EU Data Center answers on api.eu.typeform.com, or on api.typeform.eu for the newer EU data center: change the base URL if yours is one.',
  ],
  params: [],
  env: ['TYPEFORM_TOKEN'],
  requires: [],
  provider: {
    name: 'Typeform',
    docsUrl: 'https://www.typeform.com/developers/get-started/',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Typeform',
    description: 'Typeform API, authenticated with a personal access token',
    props: { token: '$env.TYPEFORM_TOKEN' },
    baseUrl: 'https://api.typeform.com',
    operations: OPERATIONS,
  }),
})
