/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Each new record is published as a LinkedIn post of the connected member. */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-linkedin-post',
  title: 'Publish each new record as a LinkedIn post',
  category: 'social',
  tags: ['linkedin', 'social', 'post', 'record', 'publish'],
  description:
    'An automation that publishes a post on behalf of the connected LinkedIn member each time a record is created in one of your tables.',
  notes: [
    "The automation runs when a record is created in `table`, reads the connected member through the `get-userinfo` operation of the `linkedin` connection, which is installed with it, and publishes the record's `textField` as a post of that member with `create-post`, visible to `visibility`.",
    'The post is published as the member who connected; posting as an organization page needs the Community Management API, which LinkedIn grants on application. LinkedIn limits a member to about 150 posts a day through the API.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table whose new records are published.',
      type: 'string',
      default: 'announcements',
    },
    {
      name: 'textField',
      description: 'The field holding the text of the post.',
      type: 'string',
      default: 'message',
    },
    {
      name: 'visibility',
      description: 'PUBLIC, or CONNECTIONS for first-degree connections only.',
      type: 'string',
      default: 'PUBLIC',
    },
  ],
  tables: [
    { param: 'table', fields: [{ name: 'message', param: 'textField', type: 'long-text' }] },
  ],
  env: [],
  requires: ['connection/linkedin'],
  provider: {
    name: 'LinkedIn',
    docsUrl:
      'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'record',
      table: String(params['table'] ?? 'announcements'),
      events: ['create'],
    },
    actions: [
      {
        name: 'member',
        type: 'connection',
        operator: 'call',
        props: { connection: 'linkedin', operation: 'get-userinfo' },
      },
      {
        name: 'publish',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'linkedin',
          operation: 'create-post',
          params: {
            'X-Restli-Protocol-Version': '2.0.0',
            author: 'urn:li:person:{{steps.member.data.sub}}',
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: `{{trigger.data.record.${String(params['textField'] ?? 'message')}}}`,
                },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': String(params['visibility'] ?? 'PUBLIC'),
            },
          },
        },
      },
    ],
  }),
})
