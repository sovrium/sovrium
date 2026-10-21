/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Jotform's form webhooks, submissions and forms. */
const FORM_ID = { in: 'path', type: 'string', required: true } as const
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-form-webhook',
    method: 'POST',
    path: '/form/{formId}/webhooks',
    summary: 'Add a webhook that posts each new submission of a form to a URL',
    params: {
      formId: FORM_ID,
      webhookURL: { in: 'body', type: 'string', required: true, format: 'uri' },
    },
    body: 'form',
  },
  {
    name: 'list-form-webhooks',
    method: 'GET',
    path: '/form/{formId}/webhooks',
    summary: "List a form's webhooks",
    params: { formId: FORM_ID },
  },
  {
    name: 'delete-form-webhook',
    method: 'DELETE',
    path: '/form/{formId}/webhooks/{webhookId}',
    summary: "Delete one of a form's webhooks",
    params: { formId: FORM_ID, webhookId: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-form-submissions',
    method: 'GET',
    path: '/form/{formId}/submissions',
    summary: "List a form's submissions",
    params: {
      formId: FORM_ID,
      offset: { in: 'query', type: 'integer' },
      limit: { in: 'query', type: 'integer' },
      orderby: { in: 'query', type: 'string', description: 'A submission field to order by' },
      filter: { in: 'query', type: 'string', description: 'A JSON filter on submission fields' },
    },
  },
  {
    name: 'list-forms',
    method: 'GET',
    path: '/user/forms',
    summary: "List the account's forms",
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'jotform',
  title: 'Jotform webhooks (API key)',
  category: 'productivity',
  tags: ['jotform', 'forms', 'submissions', 'webhooks'],
  description:
    'Authenticated calls to the Jotform API, with operations to register form webhooks and to read forms and submissions.',
  notes: [
    'Create an API key in your Jotform account and set it as `JOTFORM_API_KEY`. It is sent in the `APIKEY` header.',
    'To receive each new submission, give an automation a `webhook` trigger and call `create-form-webhook` once with its URL.',
    'An EU or HIPAA Jotform account answers on eu-api.jotform.com or hipaa-api.jotform.com: change the base URL if yours is one.',
  ],
  params: [],
  env: ['JOTFORM_API_KEY'],
  requires: [],
  provider: { name: 'Jotform', docsUrl: 'https://api.jotform.com/docs/', verifiedOn: '2026-10-20' },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Jotform',
    description: 'Jotform API, authenticated with an API key',
    props: { key: '$env.JOTFORM_API_KEY', header: 'APIKEY' },
    baseUrl: 'https://api.jotform.com',
    operations: OPERATIONS,
  }),
})
