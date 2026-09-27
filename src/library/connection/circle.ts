/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Hand-picked from Circle's Admin API v2 reference. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-member',
    method: 'POST',
    path: '/community_members',
    summary: 'Invite a member to the community, optionally into spaces',
    params: {
      email: { in: 'body', type: 'string', required: true, format: 'email' },
      name: { in: 'body', type: 'string' },
      headline: { in: 'body', type: 'string' },
      skip_invitation: {
        in: 'body',
        type: 'boolean',
        description: 'Add the member without sending the invitation email',
      },
      space_ids: { in: 'body', type: 'array', items: { type: 'integer' } },
      space_group_ids: { in: 'body', type: 'array', items: { type: 'integer' } },
      member_tag_ids: { in: 'body', type: 'array', items: { type: 'integer' } },
    },
  },
  {
    name: 'list-members',
    method: 'GET',
    path: '/community_members',
    summary: 'List the members of the community',
    params: {
      page: { in: 'query', type: 'integer' },
      per_page: { in: 'query', type: 'integer' },
      status: { in: 'query', type: 'string' },
    },
    pagination: { style: 'page', pageParam: 'page', itemsPath: 'records' },
  },
  {
    name: 'get-member',
    method: 'GET',
    path: '/community_members/{id}',
    summary: 'Retrieve one member',
    params: { id: { in: 'path', type: 'integer', required: true } },
  },
]

/** Circle's Admin API v2, authenticated by an admin API token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'circle',
  title: 'Community members with Circle (admin token)',
  category: 'community',
  tags: ['circle', 'community', 'members', 'invite', 'membership'],
  description:
    'Authenticated calls to the Circle Admin API with an admin token, with operations to invite and list community members.',
  notes: [
    'Create an Admin API v2 token in your Circle community under Developers, Tokens, and set it as the environment variable. The connection sends it in the `Authorization` header.',
    '`create-member` invites a person by email and can place them in spaces at once with `space_ids`; set `skip_invitation: true` to add them without the invitation email. `list-members` pages by number: call it with `paginate: all` to read the whole community.',
  ],
  params: [],
  env: ['CIRCLE_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Circle',
    docsUrl: 'https://api.circle.so/apis/admin-api',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Circle',
    description: 'Circle Admin API v2, authenticated with an admin token',
    props: { token: '$env.CIRCLE_API_TOKEN' },
    baseUrl: 'https://app.circle.so/api/admin/v2',
    operations: OPERATIONS,
  }),
})
