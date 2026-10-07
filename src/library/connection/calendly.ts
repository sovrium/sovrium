/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Bookings of the Calendly API v2: who you are, your events, their invitees. */
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
]

/** Calendly, authenticated with a personal access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'calendly',
  title: 'Scheduling with Calendly (personal access token)',
  category: 'productivity',
  tags: ['calendly', 'scheduling', 'booking', 'meetings', 'calendar'],
  description:
    'Authenticated calls to the Calendly API v2, with operations to read your booked events and their invitees.',
  notes: [
    'Create a personal access token in Calendly under Integrations and apps, API and webhooks, and set it as `CALENDLY_TOKEN`. Calls run as the user who created the token.',
    'Listings name the user or organization they read by URI, never by plain id: call `get-current-user` once and copy `resource.uri` or `resource.current_organization` into the step. The listings page with a token; call them with `paginate: all` to read every page. To read bookings on a schedule, run `list-scheduled-events` from an automation with a `cron` trigger and a `min_start_time`.',
  ],
  params: [],
  env: ['CALENDLY_TOKEN'],
  requires: [],
  provider: {
    name: 'Calendly',
    docsUrl: 'https://developer.calendly.com/api-docs',
    verifiedOn: '2026-10-06',
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
