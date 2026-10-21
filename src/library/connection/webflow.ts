/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** The Webflow Data API v2: webhooks, sites, forms and their submissions. */
const SITE_ID = { in: 'path', type: 'string', required: true } as const
const PAGE = {
  limit: { in: 'query', type: 'integer', description: 'At most 100' },
  offset: { in: 'query', type: 'integer' },
} as const
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-webhook',
    method: 'POST',
    path: '/v2/sites/{site_id}/webhooks',
    summary: 'Create a webhook for a site, such as one per form submission',
    params: {
      site_id: SITE_ID,
      triggerType: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'form_submission for a form',
      },
      url: { in: 'body', type: 'string', required: true, format: 'uri' },
      filter: {
        in: 'body',
        type: 'object',
        description: '{ name } of the form, for form_submission only',
      },
    },
  },
  {
    name: 'list-webhooks',
    method: 'GET',
    path: '/v2/sites/{site_id}/webhooks',
    summary: "List a site's webhooks",
    params: { site_id: SITE_ID },
  },
  {
    name: 'delete-webhook',
    method: 'DELETE',
    path: '/v2/webhooks/{webhook_id}',
    summary: 'Delete a webhook',
    params: { webhook_id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-sites',
    method: 'GET',
    path: '/v2/sites',
    summary: 'List the sites the token reaches',
  },
  {
    name: 'list-forms',
    method: 'GET',
    path: '/v2/sites/{site_id}/forms',
    summary: "List a site's forms",
    params: { site_id: SITE_ID, ...PAGE },
  },
  {
    name: 'list-form-submissions',
    method: 'GET',
    path: '/v2/sites/{site_id}/forms/{form_id}/submissions',
    summary: "List a form's submissions",
    params: {
      site_id: SITE_ID,
      form_id: { in: 'path', type: 'string', required: true },
      ...PAGE,
    },
  },
]

export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'webflow',
  title: 'Webflow webhooks (site token)',
  category: 'marketing',
  tags: ['webflow', 'website', 'forms', 'webhooks', 'cms'],
  description:
    'Authenticated calls to the Webflow Data API, with operations to register webhooks and to read sites, forms and form submissions.',
  notes: [
    'Create a site token for the site with the sites:read, sites:write and forms:read scopes, and set it as `WEBFLOW_API_TOKEN`.',
    'To receive each form submission, give an automation a `webhook` trigger and call `create-webhook` once with `triggerType: form_submission`, its URL, and a `filter` naming the form. A site accepts 75 webhooks per trigger type.',
  ],
  params: [],
  env: ['WEBFLOW_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Webflow',
    docsUrl: 'https://developers.webflow.com/data/reference/webhooks/create',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Webflow',
    description: 'Webflow Data API, authenticated with a token',
    props: { token: '$env.WEBFLOW_API_TOKEN' },
    baseUrl: 'https://api.webflow.com',
    operations: OPERATIONS,
  }),
})
