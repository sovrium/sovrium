/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each Calendly booking arrives as a webhook and becomes a row of one of the
 * operator's tables. Calendly signs every delivery with
 * `Calendly-Webhook-Signature: t=<timestamp>,v1=<hex>` over
 * `<timestamp>.<raw body>` — the Stripe layout under another header — which
 * the webhook trigger verifies with the `hmac-timestamp` scheme before
 * anything runs. The delivery carries the invitee and the event, so no API
 * call is needed to file it.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'calendly-booking-to-table',
  title: 'File each Calendly booking into a table',
  category: 'productivity',
  tags: ['calendly', 'scheduling', 'booking', 'meetings', 'webhook'],
  description:
    'A webhook automation that receives each new Calendly booking, checks its signature and adds the invitee and the event as a row of your table.',
  notes: [
    'Calendly sends webhooks to a subscription you create with its API: post to `https://api.calendly.com/webhook_subscriptions` with the webhook address of this automation (`<your address>/api/automations/<name>/webhook`), the `invitee.created` event, your organization or user URI as `scope`, and a `signing_key` you choose. Set that same key as `CALENDLY_WEBHOOK_SIGNING_KEY`.',
    "Every delivery is checked before anything runs: the signature in `Calendly-Webhook-Signature` must match the key, and its timestamp may be at most three minutes old, so a replayed delivery is refused. Each accepted booking adds one row to `table` with the invitee's name and email, the event's name, start and end time, and the invitee's Calendly URI.",
  ],
  params: [
    {
      name: 'table',
      description: 'The table each booking is added to.',
      type: 'string',
      default: 'calendly_bookings',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'invitee_name', type: 'single-line-text' },
        { name: 'invitee_email', type: 'email' },
        { name: 'event_name', type: 'single-line-text' },
        { name: 'start_time', type: 'single-line-text' },
        { name: 'end_time', type: 'single-line-text' },
        { name: 'invitee_uri', type: 'url' },
      ],
    },
  ],
  env: ['CALENDLY_WEBHOOK_SIGNING_KEY'],
  requires: [],
  provider: {
    name: 'Calendly',
    docsUrl: 'https://developer.calendly.com/api-docs',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'webhook',
      method: 'POST',
      auth: {
        type: 'hmac',
        scheme: 'hmac-timestamp',
        header: 'Calendly-Webhook-Signature',
        format: 't=<ts>,v1=<sig>',
        secret: '$env.CALENDLY_WEBHOOK_SIGNING_KEY',
        tolerance: 180,
      },
    },
    actions: [
      {
        name: 'fileBooking',
        type: 'record',
        operator: 'create',
        props: {
          table: String(params['table'] ?? 'calendly_bookings'),
          data: {
            invitee_name: '{{trigger.data.body.payload.name}}',
            invitee_email: '{{trigger.data.body.payload.email}}',
            event_name: '{{trigger.data.body.payload.scheduled_event.name}}',
            start_time: '{{trigger.data.body.payload.scheduled_event.start_time}}',
            end_time: '{{trigger.data.body.payload.scheduled_event.end_time}}',
            invitee_uri: '{{trigger.data.body.payload.uri}}',
          },
        },
      },
    ],
  }),
})
