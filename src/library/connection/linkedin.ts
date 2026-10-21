/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** The two headers every Lead Sync call takes. */
const LEAD_SYNC_HEADERS = {
  'LinkedIn-Version': {
    in: 'header',
    type: 'string',
    required: true,
    description: 'The API version as YYYYMM, for example 202610',
  },
  'X-Restli-Protocol-Version': { in: 'header', type: 'string', required: true, enum: ['2.0.0'] },
} as const

/** Hand-picked from the Share on LinkedIn, Sign In with LinkedIn and Lead Sync guides. */
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
  {
    name: 'list-lead-forms',
    method: 'GET',
    path: '/rest/leadForms',
    summary: 'List the lead forms of an ad account or an organization',
    params: {
      ...LEAD_SYNC_HEADERS,
      q: { in: 'query', type: 'string', required: true, enum: ['owner'] },
      owner: {
        in: 'query',
        type: 'string',
        required: true,
        description:
          '(organization:urn:li:organization:<id>) or (sponsoredAccount:urn:li:sponsoredAccount:<id>)',
      },
      count: { in: 'query', type: 'integer' },
      start: { in: 'query', type: 'integer' },
    },
  },
  {
    name: 'list-lead-form-responses',
    method: 'GET',
    path: '/rest/leadFormResponses',
    summary: 'List the responses (leads) collected by an owner, optionally for one form',
    params: {
      ...LEAD_SYNC_HEADERS,
      q: { in: 'query', type: 'string', required: true, enum: ['owner'] },
      owner: {
        in: 'query',
        type: 'string',
        required: true,
        description: '(sponsoredAccount:urn:li:sponsoredAccount:<id>) or (organization:…)',
      },
      leadType: {
        in: 'query',
        type: 'string',
        required: true,
        description: '(leadType:SPONSORED) for leads from ads',
      },
      versionedLeadGenFormUrn: { in: 'query', type: 'string' },
      limitedToTestLeads: { in: 'query', type: 'boolean' },
    },
  },
  {
    name: 'get-lead-form-response',
    method: 'GET',
    path: '/rest/leadFormResponses/{id}',
    summary: 'Read one lead form response',
    params: { ...LEAD_SYNC_HEADERS, id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'create-lead-notification',
    method: 'POST',
    path: '/rest/leadNotifications',
    summary: 'Send each new lead of an owner, or of one form, to a webhook address',
    params: {
      ...LEAD_SYNC_HEADERS,
      webhook: { in: 'body', type: 'string', format: 'uri', required: true },
      owner: {
        in: 'body',
        type: 'object',
        required: true,
        description:
          '{ "sponsoredAccount": "urn:li:sponsoredAccount:<id>" } or { "organization": … }',
      },
      leadType: { in: 'body', type: 'string', description: 'SPONSORED for leads from ads' },
      versionedForm: {
        in: 'body',
        type: 'string',
        description: 'urn:li:versionedLeadGenForm:(urn:li:leadGenForm:<id>,<version>)',
      },
    },
  },
  {
    name: 'list-lead-notifications',
    method: 'GET',
    path: '/rest/leadNotifications',
    summary: 'List the lead notification subscriptions of an owner',
    params: {
      ...LEAD_SYNC_HEADERS,
      q: { in: 'query', type: 'string', required: true, enum: ['criteria'] },
      owner: {
        in: 'query',
        type: 'string',
        required: true,
        description: '(value:(sponsoredAccount:urn:li:sponsoredAccount:<id>))',
      },
      leadType: { in: 'query', type: 'string', description: '(leadType:SPONSORED)' },
    },
  },
  {
    name: 'delete-lead-notification',
    method: 'DELETE',
    path: '/rest/leadNotifications/{id}',
    summary: 'Stop a lead notification subscription',
    params: { ...LEAD_SYNC_HEADERS, id: { in: 'path', type: 'string', required: true } },
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
    'A LinkedIn member connected with OAuth, with operations to read the member, publish a post on their behalf, and read lead forms and their responses.',
  notes: [
    'Create an app in the LinkedIn Developer Portal, add the Sign In with LinkedIn using OpenID Connect and Share on LinkedIn products, register the redirect URI `sovrium library add` prints, and set the client id and secret as environment variables. Connect the member from your app once.',
    'LinkedIn access tokens last about 60 days and this flow returns no refresh token: when the token expires the member connects again. Posting as an organization page needs the Community Management API, which LinkedIn grants on application; this connection posts as the member.',
    'Lead forms are read through the Lead Sync API, a separate program LinkedIn grants on application; access to the Advertising API does not include it. Once granted, install with `--set leadSync=on`, which adds the three permissions Lead Sync needs: `r_marketing_leadgen_automation`, `r_ads` and `r_organization_admin`. Every Lead Sync call takes a `LinkedIn-Version` header (YYYYMM) and `X-Restli-Protocol-Version: 2.0.0`. LinkedIn sends lead notifications only to a webhook that has answered its validation challenge.',
  ],
  params: [
    {
      name: 'leadSync',
      description:
        'on once LinkedIn has granted your app the Lead Sync API, to request the scopes it needs; off keeps the member scopes only.',
      type: 'string',
      default: 'off',
    },
  ],
  env: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'LinkedIn',
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync',
    verifiedOn: '2026-10-20',
  },
  build: ({ name, params }) => ({
    name,
    type: 'oauth2',
    label: 'LinkedIn',
    description: 'LinkedIn API, connected with OAuth',
    props: {
      provider: 'linkedin',
      clientId: '$env.LINKEDIN_CLIENT_ID',
      clientSecret: '$env.LINKEDIN_CLIENT_SECRET',
      scopes: [
        'openid',
        'profile',
        'email',
        'w_member_social',
        ...(params['leadSync'] === 'on'
          ? ['r_marketing_leadgen_automation', 'r_ads', 'r_organization_admin']
          : []),
      ],
    },
    baseUrl: 'https://api.linkedin.com',
    operations: OPERATIONS,
  }),
})
