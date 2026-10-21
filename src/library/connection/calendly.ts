/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Bookings of the Calendly API v2: who you are, your events, their invitees, and webhooks. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'get-current-user',
    method: 'GET',
    path: '/users/me',
    summary: 'Read the connected user, with the user and organization URIs the listings need',
  },
  {
    name: 'list-scheduled-events',
    method: 'GET',
    path: '/scheduled_events',
    summary: 'List the booked events of a user or an organization',
    params: {
      user: { in: 'query', type: 'string', format: 'uri', description: 'A user URI' },
      organization: { in: 'query', type: 'string', format: 'uri' },
      status: { in: 'query', type: 'string', enum: ['active', 'canceled'] },
      min_start_time: { in: 'query', type: 'string', format: 'date-time' },
      max_start_time: { in: 'query', type: 'string', format: 'date-time' },
      count: { in: 'query', type: 'integer' },
      page_token: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'page_token',
      cursorPath: 'pagination.next_page_token',
      itemsPath: 'collection',
    },
  },
  {
    name: 'list-event-invitees',
    method: 'GET',
    path: '/scheduled_events/{uuid}/invitees',
    summary: 'List the people who booked an event, with their answers',
    params: {
      uuid: { in: 'path', type: 'string', required: true },
      count: { in: 'query', type: 'integer' },
      page_token: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'page_token',
      cursorPath: 'pagination.next_page_token',
      itemsPath: 'collection',
    },
  },
  {
    name: 'create-webhook-subscription',
    method: 'POST',
    path: '/webhook_subscriptions',
    summary: 'Send booking events to a webhook address',
    params: {
      url: { in: 'body', type: 'string', format: 'uri', required: true },
      events: {
        in: 'body',
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'For example invitee.created, invitee.canceled',
      },
      organization: { in: 'body', type: 'string', format: 'uri', required: true },
      scope: {
        in: 'body',
        type: 'string',
        required: true,
        enum: ['organization', 'user', 'group'],
      },
      user: { in: 'body', type: 'string', format: 'uri' },
      group: { in: 'body', type: 'string', format: 'uri' },
      signing_key: {
        in: 'body',
        type: 'string',
        description: 'The key the webhook signature is made with',
      },
    },
  },
  {
    name: 'list-webhook-subscriptions',
    method: 'GET',
    path: '/webhook_subscriptions',
    summary: 'List the webhook subscriptions of an organization or user',
    params: {
      organization: { in: 'query', type: 'string', format: 'uri', required: true },
      scope: {
        in: 'query',
        type: 'string',
        required: true,
        enum: ['organization', 'user', 'group'],
      },
      user: { in: 'query', type: 'string', format: 'uri' },
      group: { in: 'query', type: 'string', format: 'uri' },
      count: { in: 'query', type: 'integer' },
      page_token: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'page_token',
      cursorPath: 'pagination.next_page_token',
      itemsPath: 'collection',
    },
  },
  {
    name: 'get-webhook-subscription',
    method: 'GET',
    path: '/webhook_subscriptions/{webhook_uuid}',
    summary: 'Read one webhook subscription',
    params: { webhook_uuid: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'delete-webhook-subscription',
    method: 'DELETE',
    path: '/webhook_subscriptions/{webhook_uuid}',
    summary: 'Stop sending events to a webhook address',
    params: { webhook_uuid: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'get-event-invitee',
    method: 'GET',
    path: '/scheduled_events/{event_uuid}/invitees/{invitee_uuid}',
    summary: 'Read one invitee of a booked event, with their answers',
    params: {
      event_uuid: { in: 'path', type: 'string', required: true },
      invitee_uuid: { in: 'path', type: 'string', required: true },
    },
  },
]

/** Calendly, authenticated with a personal access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'calendly',
  title: 'Scheduling with Calendly (personal access token)',
  category: 'productivity',
  tags: ['calendly', 'scheduling', 'booking', 'meetings', 'calendar'],
  description:
    'Authenticated calls to the Calendly API v2, with operations to read your booked events and their invitees and to manage webhook subscriptions.',
  notes: [
    'Create a personal access token in Calendly under Integrations and apps, API and webhooks, and set it as `CALENDLY_TOKEN`. Calls run as the user who created the token. Give the token the scopes its operations need: `users:read` and `scheduled_events:read` for the reads, `webhooks:read` and `webhooks:write` for the webhook subscriptions.',
    'Listings name the user or organization they read by URI, never by plain id: call `get-current-user` once and copy `resource.uri` or `resource.current_organization` into the step. The listings page with a token; call them with `paginate: all` to read every page. To read bookings on a schedule, run `list-scheduled-events` from an automation with a `cron` trigger and a `min_start_time`. To start an automation on each booking, call `create-webhook-subscription` with the address of a webhook automation as `url`, `events: [invitee.created]`, your organization URI and `scope: organization` (or the user URI and `scope: user`), and a `signing_key` the webhook checks.',
  ],
  params: [],
  env: ['CALENDLY_TOKEN'],
  requires: [],
  provider: {
    name: 'Calendly',
    docsUrl: 'https://developer.calendly.com/api-docs',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Calendly',
    description: 'Calendly API v2, authenticated with a personal access token',
    props: { token: '$env.CALENDLY_TOKEN' },
    baseUrl: 'https://api.calendly.com',
    operations: OPERATIONS,
  }),
})
