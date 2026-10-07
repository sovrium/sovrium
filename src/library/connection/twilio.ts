/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Messages of the Twilio Programmable Messaging API. Twilio takes form-encoded
 * bodies and names parameters in PascalCase, as declared here.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'send-message',
    method: 'POST',
    path: '/Accounts/{AccountSid}/Messages.json',
    summary: 'Send an SMS or a WhatsApp message',
    body: 'form',
    params: {
      AccountSid: { in: 'path', type: 'string', required: true },
      To: { in: 'body', type: 'string', required: true, description: 'E.164, e.g. +33612345678' },
      From: {
        in: 'body',
        type: 'string',
        description: 'A Twilio number, or use MessagingServiceSid',
      },
      MessagingServiceSid: { in: 'body', type: 'string' },
      Body: { in: 'body', type: 'string', description: 'The text, up to 1,600 characters' },
      StatusCallback: { in: 'body', type: 'string', format: 'uri' },
    },
  },
  {
    name: 'list-messages',
    method: 'GET',
    path: '/Accounts/{AccountSid}/Messages.json',
    summary: 'List the messages sent and received by the account',
    params: {
      AccountSid: { in: 'path', type: 'string', required: true },
      To: { in: 'query', type: 'string' },
      From: { in: 'query', type: 'string' },
      PageSize: { in: 'query', type: 'integer' },
    },
  },
  {
    name: 'get-message',
    method: 'GET',
    path: '/Accounts/{AccountSid}/Messages/{Sid}.json',
    summary: 'Read one message and its delivery status',
    params: {
      AccountSid: { in: 'path', type: 'string', required: true },
      Sid: { in: 'path', type: 'string', required: true },
    },
  },
]

/** Twilio, authenticated with the account SID and auth token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'twilio',
  title: 'SMS and messaging with Twilio (account SID and auth token)',
  category: 'communication',
  tags: ['twilio', 'sms', 'messaging', 'whatsapp', 'phone'],
  description:
    'Authenticated calls to the Twilio Messaging API, with operations to send and read SMS and WhatsApp messages.',
  notes: [
    'Copy the Account SID and Auth Token from the Twilio Console and set them as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`; the connection sends them with HTTP Basic. You may use an API key SID and secret instead, as the username and password, for a credential you can revoke on its own.',
    'Every operation takes the account SID as `AccountSid`: pass `$env.TWILIO_ACCOUNT_SID` once your config declares it. Send from a Twilio number in `From`, or from a messaging service with `MessagingServiceSid`; a WhatsApp recipient is written `whatsapp:+33612345678`.',
  ],
  params: [],
  env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
  requires: [],
  provider: {
    name: 'Twilio',
    docsUrl: 'https://www.twilio.com/docs/messaging/api/message-resource',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Twilio',
    description: 'Twilio REST API, authenticated with the account SID and auth token',
    props: { username: '$env.TWILIO_ACCOUNT_SID', password: '$env.TWILIO_AUTH_TOKEN' },
    baseUrl: 'https://api.twilio.com/2010-04-01',
    operations: OPERATIONS,
  }),
})
