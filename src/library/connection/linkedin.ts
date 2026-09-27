/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Hand-picked from the Share on LinkedIn and Sign In with LinkedIn guides. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-userinfo',
    method: 'GET',
    path: '/v2/userinfo',
    summary: 'Read the connected member, whose sub is the id of their person URN',
  },
  {
    name: 'create-post',
    method: 'POST',
    path: '/v2/ugcPosts',
    summary: 'Publish a post on behalf of the connected member',
    params: {
      'X-Restli-Protocol-Version': {
        in: 'header',
        type: 'string',
        required: true,
        enum: ['2.0.0'],
        description: 'Pass 2.0.0, which LinkedIn requires on this call',
      },
      author: {
        in: 'body',
        type: 'string',
        required: true,
        description: 'urn:li:person:<sub from get-userinfo>',
      },
      lifecycleState: { in: 'body', type: 'string', required: true, enum: ['PUBLISHED'] },
      specificContent: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ "com.linkedin.ugc.ShareContent": { shareCommentary, shareMediaCategory } }',
      },
      visibility: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ "com.linkedin.ugc.MemberNetworkVisibility": PUBLIC or CONNECTIONS }',
      },
    },
  },
]

/** LinkedIn with OAuth, the provider shorthand supplying LinkedIn's endpoints. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'linkedin',
  title: 'LinkedIn member posts (OAuth)',
  category: 'social',
  tags: ['linkedin', 'social', 'posts', 'share', 'oauth'],
  description:
    'A LinkedIn member connected with OAuth, with operations to read the member and publish a post on their behalf.',
  notes: [
    'Create an app in the LinkedIn Developer Portal, add the Sign In with LinkedIn using OpenID Connect and Share on LinkedIn products, register the redirect URI `sovrium library add` prints, and set the client id and secret as environment variables. Connect the member from your app once.',
    'LinkedIn access tokens last about 60 days and this flow returns no refresh token: when the token expires the member connects again. Posting as an organization page needs the Community Management API, which LinkedIn grants on application; this connection posts as the member.',
  ],
  params: [],
  env: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'LinkedIn',
    docsUrl:
      'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'LinkedIn',
    description: 'LinkedIn API, connected with OAuth',
    props: {
      provider: 'linkedin',
      clientId: '$env.LINKEDIN_CLIENT_ID',
      clientSecret: '$env.LINKEDIN_CLIENT_SECRET',
      scopes: ['openid', 'profile', 'email', 'w_member_social'],
    },
    baseUrl: 'https://api.linkedin.com',
    operations: OPERATIONS,
  }),
})
