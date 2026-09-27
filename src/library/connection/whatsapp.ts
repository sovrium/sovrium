/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Hand-picked, deliberately: the generated `send-message` declares the message
 * `type` as a closed list holding only `contacts`, so a template message cannot
 * be sent through it. This operation has its own name so the two never collide.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'send-template-message',
    method: 'POST',
    path: '/{phone_number_id}/messages',
    summary: 'Send an approved message template to a WhatsApp number',
    params: {
      phone_number_id: { in: 'path', type: 'string', required: true },
      messaging_product: { in: 'body', type: 'string', required: true, enum: ['whatsapp'] },
      to: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'Recipient number, international format',
      },
      type: { in: 'body', type: 'string', required: true, enum: ['template'] },
      template: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ name, language: { code }, components }',
      },
    },
  },
  {
    name: 'send-text-message',
    method: 'POST',
    path: '/{phone_number_id}/messages',
    summary: 'Send a free-form text, only within 24 hours of the last message from that person',
    params: {
      phone_number_id: { in: 'path', type: 'string', required: true },
      messaging_product: { in: 'body', type: 'string', required: true, enum: ['whatsapp'] },
      to: { in: 'body', type: 'string', required: true },
      type: { in: 'body', type: 'string', required: true, enum: ['text'] },
      text: { in: 'body', type: 'object', required: true, description: '{ body }' },
    },
  },
]

/** WhatsApp Cloud API with the permanent token of a system user. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'whatsapp',
  title: 'WhatsApp Business messages (Cloud API token)',
  category: 'communication',
  tags: ['whatsapp', 'meta', 'messages', 'sms', 'notifications', 'templates'],
  description:
    'Authenticated calls to the WhatsApp Cloud API with a system user token, with operations to send template and text messages.',
  notes: [
    'In Meta Business Suite, add a system user to the business owning your WhatsApp Business account, give it the WhatsApp app with the `whatsapp_business_messaging` permission, generate a token that does not expire, and set it as `WHATSAPP_TOKEN`. The number to send from is identified by its phone number id, shown in the WhatsApp Manager.',
    'Outside the 24 hours after a person last wrote to you, WhatsApp only delivers approved templates: send those with `send-template-message`, naming the template and its language code. Add other endpoints with `sovrium library add whatsapp/<operation>`.',
  ],
  params: [],
  env: ['WHATSAPP_TOKEN'],
  requires: [],
  provider: {
    name: 'WhatsApp Business Platform',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'WhatsApp',
    description: 'WhatsApp Cloud API, authenticated with a system user token',
    props: { token: '$env.WHATSAPP_TOKEN' },
    baseUrl: 'https://graph.facebook.com/v23.0',
    operations: OPERATIONS,
  }),
})
