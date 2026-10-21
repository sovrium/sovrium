/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * A curated subset of the Graph API for Facebook Pages. A Page is published to
 * with a PAGE token, which the connected user's token reads from the Page itself
 * (`get-page-token`), so posting is two steps and both are here.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-pages',
    method: 'GET',
    path: '/me/accounts',
    summary: 'List the Pages the connected user manages, with their ids',
    params: { fields: { in: 'query', type: 'string', description: 'For example id,name' } },
  },
  {
    name: 'get-page-token',
    method: 'GET',
    path: '/{page_id}',
    summary: 'Read the access token of one Page the user manages',
    params: {
      page_id: { in: 'path', type: 'string', required: true },
      fields: { in: 'query', type: 'string', required: true, enum: ['access_token'] },
    },
  },
  {
    name: 'publish-page-post',
    method: 'POST',
    path: '/{page_id}/feed',
    summary: 'Publish a post on a Page, with the Page token',
    params: {
      page_id: { in: 'path', type: 'string', required: true },
      access_token: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'The Page token read by get-page-token',
      },
      message: { in: 'body', type: 'string' },
      link: { in: 'body', type: 'string', format: 'uri' },
    },
  },
  {
    name: 'get-lead',
    method: 'GET',
    path: '/{lead_id}',
    summary: 'Read the answers of one lead ads form submission',
    params: {
      lead_id: { in: 'path', type: 'string', required: true },
      access_token: {
        in: 'query',
        type: 'string',
        description: 'A Page token of the Page owning the form',
      },
    },
  },
  {
    name: 'subscribe-page-app',
    method: 'POST',
    path: '/{page_id}/subscribed_apps',
    summary: "Install the app on a Page for the Page's webhook fields, such as leadgen",
    params: {
      page_id: { in: 'path', type: 'string', required: true },
      subscribed_fields: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'leadgen to receive each lead ads submission',
      },
      access_token: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'The Page token read by get-page-token',
      },
    },
  },
  {
    name: 'list-page-subscribed-apps',
    method: 'GET',
    path: '/{page_id}/subscribed_apps',
    summary: 'Read which apps a Page is installed on, and for which fields',
    params: {
      page_id: { in: 'path', type: 'string', required: true },
      access_token: { in: 'query', type: 'string', required: true, description: 'The Page token' },
    },
  },
  {
    name: 'list-form-leads',
    method: 'GET',
    path: '/{form_id}/leads',
    summary: 'List the leads of one lead ads form',
    params: {
      form_id: { in: 'path', type: 'string', required: true },
      access_token: {
        in: 'query',
        type: 'string',
        description: 'A Page token of the Page owning the form',
      },
      filtering: {
        in: 'query',
        type: 'string',
        description: '[{"field":"time_created","operator":"GREATER_THAN","value":<unix time>}]',
      },
      fields: { in: 'query', type: 'string' },
      after: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'after',
      cursorPath: 'paging.cursors.after',
      itemsPath: 'data',
    },
  },
]

/**
 * Meta's Graph API for Facebook Pages with OAuth. The token of the code
 * exchange lasts hours; `longLivedToken` swaps it at the callback for one of
 * about 60 days and renews it before it lapses.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'facebook',
  title: 'Facebook Pages (OAuth)',
  category: 'social',
  tags: ['facebook', 'meta', 'pages', 'social', 'posts', 'lead-ads', 'oauth'],
  description:
    'A Facebook account connected with OAuth, with operations to publish on the Pages it manages, subscribe a Page to lead ads and read their submissions.',
  notes: [
    'Create an app in Meta for Developers, add Facebook Login with the redirect URI `sovrium library add` prints, and set the app id and secret as environment variables. Connect the account that manages your Page from your app once. Until Meta reviews the app, only people with a role on it can connect; publishing needs the `pages_manage_posts` permission, reading leads `leads_retrieval`.',
    'The connection exchanges the short-lived token of the login for a long-lived one and renews it. A Page is published to with its own token: read it with `get-page-token`, then pass it to `publish-page-post` as `access_token`.',
    "For lead ads, install with `--set leadAds=on`, subscribe your Page with `subscribe-page-app` (`subscribed_fields: leadgen`, the Page token), and read the answers of each lead with `get-lead`, or a form's leads since a time with `list-form-leads`. The `meta-lead-ads-to-table` recipe receives the webhook for you.",
  ],
  params: [
    {
      name: 'leadAds',
      description:
        'on to request the permissions lead ads webhooks and lead reads need; off keeps the posting permissions only.',
      type: 'string',
      default: 'off',
    },
  ],
  env: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  requires: [],
  provider: {
    name: 'Meta Graph API',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving',
    verifiedOn: '2026-10-20',
  },
  build: ({ name, params }) => ({
    name,
    type: 'oauth2',
    label: 'Facebook',
    description: 'Meta Graph API for Facebook Pages, connected with OAuth',
    props: {
      clientId: '$env.FACEBOOK_APP_ID',
      clientSecret: '$env.FACEBOOK_APP_SECRET',
      authorizationUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
      scopes: [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'leads_retrieval',
        ...(params['leadAds'] === 'on'
          ? ['pages_manage_metadata', 'pages_manage_ads', 'ads_management']
          : []),
      ],
      longLivedToken: { style: 'meta' },
    },
    baseUrl: 'https://graph.facebook.com/v25.0',
    operations: OPERATIONS,
  }),
})
