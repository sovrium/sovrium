/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record of one of the operator's tables is published on a Facebook
 * Page. A Page is published to with its own token, which the connected user's
 * token reads from the Page first — two steps.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-facebook-post',
  title: 'Publish each new record as a Facebook Page post',
  category: 'social',
  tags: ['facebook', 'meta', 'social', 'post', 'record', 'publish'],
  description:
    'An automation that publishes a post on one of your Facebook Pages each time a record is created in one of your tables.',
  notes: [
    "The automation runs when a record is created in `table`, reads the access token of the Page `pageId` through the `get-page-token` operation of the `facebook` connection, which is installed with it, then publishes the record's `messageField` as a post with `publish-page-post`.",
    'The connected account must manage the Page, and the app must hold the `pages_manage_posts` permission — during development only people with a role on the app can connect. Find the Page id in the Page settings, under Page transparency.',
  ],
  params: [
    {
      name: 'pageId',
      description: 'The id of the Page to publish on.',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table whose new records are published.',
      type: 'string',
      default: 'announcements',
    },
    {
      name: 'messageField',
      description: 'The field holding the text of the post.',
      type: 'string',
      default: 'message',
    },
  ],
  tables: [
    { param: 'table', fields: [{ name: 'message', param: 'messageField', type: 'long-text' }] },
  ],
  env: [],
  requires: ['connection/facebook'],
  provider: {
    name: 'Meta Graph API',
    docsUrl: 'https://developers.facebook.com/docs/pages-api/posts',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const pageId = String(params['pageId'] ?? '')
    return {
      name,
      trigger: {
        type: 'record',
        table: String(params['table'] ?? 'announcements'),
        events: ['create'],
      },
      actions: [
        {
          name: 'pageToken',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'facebook',
            operation: 'get-page-token',
            params: { page_id: pageId, fields: 'access_token' },
          },
        },
        {
          name: 'publish',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'facebook',
            operation: 'publish-page-post',
            params: {
              page_id: pageId,
              access_token: '{{steps.pageToken.data.access_token}}',
              message: `{{trigger.data.record.${String(params['messageField'] ?? 'message')}}}`,
            },
          },
        },
      ],
    }
  },
})
