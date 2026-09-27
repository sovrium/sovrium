/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Facebook lead ads submissions arrive as webhooks and become rows of one of
 * the operator's tables. The webhook answers Meta's subscription handshake
 * itself and checks the `X-Hub-Signature-256` of every delivery against the
 * app secret; the lead's answers are then read through the Facebook
 * connection, since the delivery carries only the lead id.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'meta-lead-ads-to-table',
  title: 'File each Facebook lead ads submission into a table',
  category: 'social',
  tags: ['facebook', 'meta', 'lead-ads', 'leads', 'webhook', 'marketing'],
  description:
    'A webhook automation that receives each Facebook lead ads submission, reads its answers and adds it as a row of your table.',
  notes: [
    "In your Meta app, subscribe the `leadgen` field of your Page to the webhook address of this automation (`<your address>/api/automations/<name>/webhook`) with the verify token set in `META_VERIFY_TOKEN`: the automation answers Meta's verification request by itself. Every delivery is then checked against the app secret before anything runs.",
    'For each delivery the automation reads the lead through the `get-lead` operation of the `facebook` connection, which is installed with it, and adds one row to `table` with the lead id, its answers as JSON and its creation time. The connected account needs the `leads_retrieval` permission on the Page.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table each lead is added to.',
      type: 'string',
      default: 'facebook_leads',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'leadgen_id', type: 'single-line-text' },
        { name: 'answers', type: 'long-text' },
        { name: 'created_time', type: 'single-line-text' },
      ],
    },
  ],
  env: ['META_VERIFY_TOKEN', 'FACEBOOK_APP_SECRET'],
  requires: ['connection/facebook'],
  provider: {
    name: 'Meta Graph API',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'webhook',
      method: 'POST',
      verification: { style: 'meta', verifyToken: '$env.META_VERIFY_TOKEN' },
      auth: {
        type: 'hmac',
        secret: '$env.FACEBOOK_APP_SECRET',
        header: 'X-Hub-Signature-256',
        prefix: 'sha256=',
      },
    },
    actions: [
      {
        name: 'lead',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'facebook',
          operation: 'get-lead',
          params: { lead_id: '{{trigger.data.body.entry.0.changes.0.value.leadgen_id}}' },
        },
      },
      {
        name: 'fileLead',
        type: 'record',
        operator: 'create',
        props: {
          table: String(params['table'] ?? 'facebook_leads'),
          data: {
            leadgen_id: '{{steps.lead.data.id}}',
            answers: '{{json steps.lead.data.field_data}}',
            created_time: '{{steps.lead.data.created_time}}',
          },
        },
      },
    ],
  }),
})
