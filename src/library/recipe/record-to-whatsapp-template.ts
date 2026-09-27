/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record — an appointment, an order — sends an approved WhatsApp
 * template to the phone number it holds. Outside a conversation the person
 * opened, WhatsApp delivers only approved templates.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-whatsapp-template',
  title: 'Send a WhatsApp template message for each new record',
  category: 'communication',
  tags: ['whatsapp', 'meta', 'message', 'notification', 'appointment', 'record'],
  description:
    'An automation that sends an approved WhatsApp message template to the phone number of each new record of one of your tables.',
  notes: [
    "The automation runs when a record is created in `table` and sends the template `template`, in the language `language`, to the number in the record's `phoneField`, from your WhatsApp business number, through the `send-template-message` operation of the `whatsapp` connection, which is installed with it.",
    'Create and get the template approved in the WhatsApp Manager first. Numbers are expected in international format; a template with variables needs its `components` added to the `template` of the installed step. Set `WHATSAPP_PHONE_NUMBER_ID` to the id of the number you send from.',
  ],
  params: [
    {
      name: 'template',
      description: 'The name of the approved template.',
      type: 'string',
      required: true,
    },
    {
      name: 'language',
      description: 'The language code the template was approved in.',
      type: 'string',
      default: 'fr',
    },
    {
      name: 'table',
      description: 'The table whose new records trigger a message.',
      type: 'string',
      default: 'appointments',
    },
    {
      name: 'phoneField',
      description: 'The field holding the recipient phone number.',
      type: 'string',
      default: 'phone',
    },
  ],
  tables: [
    { param: 'table', fields: [{ name: 'phone', param: 'phoneField', type: 'phone-number' }] },
  ],
  env: ['WHATSAPP_PHONE_NUMBER_ID'],
  requires: ['connection/whatsapp'],
  provider: {
    name: 'WhatsApp Business Platform',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'record',
      table: String(params['table'] ?? 'appointments'),
      events: ['create'],
    },
    actions: [
      {
        name: 'sendTemplate',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'whatsapp',
          operation: 'send-template-message',
          params: {
            phone_number_id: '$env.WHATSAPP_PHONE_NUMBER_ID',
            messaging_product: 'whatsapp',
            to: `{{trigger.data.record.${String(params['phoneField'] ?? 'phone')}}}`,
            type: 'template',
            template: {
              name: String(params['template'] ?? ''),
              language: { code: String(params['language'] ?? 'fr') },
            },
          },
        },
      },
    ],
  }),
})
