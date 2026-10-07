/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Audiences, their members and campaigns, from the Mailchimp Marketing API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-audiences',
    method: 'GET',
    path: '/lists',
    summary: 'List the audiences of the account',
    params: {
      count: { in: 'query', type: 'integer' },
      offset: { in: 'query', type: 'integer' },
    },
    pagination: {
      style: 'offset',
      offsetParam: 'offset',
      limitParam: 'count',
      limit: 100,
      itemsPath: 'lists',
    },
  },
  {
    name: 'add-member',
    method: 'POST',
    path: '/lists/{list_id}/members',
    summary: 'Add a contact to an audience',
    params: {
      list_id: { in: 'path', type: 'string', required: true },
      email_address: { in: 'body', type: 'string', required: true, format: 'email' },
      status: {
        in: 'body',
        type: 'string',
        required: true,
        enum: ['subscribed', 'unsubscribed', 'cleaned', 'pending', 'transactional'],
      },
      merge_fields: { in: 'body', type: 'object', description: 'e.g. { FNAME, LNAME }' },
      tags: { in: 'body', type: 'array', items: { type: 'string' } },
      language: { in: 'body', type: 'string' },
    },
  },
  {
    name: 'list-campaigns',
    method: 'GET',
    path: '/campaigns',
    summary: 'List the campaigns of the account',
    params: {
      status: {
        in: 'query',
        type: 'string',
        enum: ['save', 'paused', 'schedule', 'sending', 'sent'],
      },
      count: { in: 'query', type: 'integer' },
      offset: { in: 'query', type: 'integer' },
    },
    pagination: {
      style: 'offset',
      offsetParam: 'offset',
      limitParam: 'count',
      limit: 100,
      itemsPath: 'campaigns',
    },
  },
]

/** Mailchimp Marketing API, authenticated with an API key. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'mailchimp',
  title: 'Email marketing with Mailchimp (API key)',
  category: 'marketing',
  tags: ['mailchimp', 'newsletter', 'audience', 'email-marketing', 'campaigns'],
  description:
    'Authenticated calls to the Mailchimp Marketing API, with operations for audiences, their members and campaigns.',
  notes: [
    "Create an API key in Mailchimp under Profile, Extras, API keys, and set it as `MAILCHIMP_API_KEY`. The part after the dash at the end of the key is your data center, such as `us21`: set it as `MAILCHIMP_SERVER_PREFIX`, since every call goes to that data center's address. The key is sent with HTTP Basic, which Mailchimp documents for server-to-server calls.",
    '`add-member` refuses an address already in the audience. Adding someone with `status: subscribed` skips the confirmation email, so use it only for people who opted in; `pending` sends the confirmation instead.',
  ],
  params: [],
  env: ['MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER_PREFIX'],
  requires: [],
  provider: {
    name: 'Mailchimp',
    docsUrl: 'https://mailchimp.com/developer/marketing/api/',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Mailchimp',
    description: 'Mailchimp Marketing API, authenticated with an API key',
    props: { username: 'sovrium', password: '$env.MAILCHIMP_API_KEY' },
    baseUrl: 'https://$env.MAILCHIMP_SERVER_PREFIX.api.mailchimp.com/3.0',
    operations: OPERATIONS,
  }),
})
