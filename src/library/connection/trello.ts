/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Boards, lists, cards and webhooks of the Trello REST API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-webhook',
    method: 'POST',
    path: '/webhooks',
    summary: 'Watch a board, list, card or member: Trello posts every action on it to callbackURL',
    params: {
      callbackURL: {
        in: 'query',
        type: 'string',
        format: 'uri',
        required: true,
        description:
          'The address of the automation webhook; Trello checks it with a HEAD request first',
      },
      idModel: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'The id of the board, list, card or member to watch',
      },
      description: { in: 'query', type: 'string' },
      active: { in: 'query', type: 'boolean' },
    },
  },
  {
    name: 'get-webhook',
    method: 'GET',
    path: '/webhooks/{id}',
    summary: 'Read one webhook',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'delete-webhook',
    method: 'DELETE',
    path: '/webhooks/{id}',
    summary: 'Stop a webhook',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-member-boards',
    method: 'GET',
    path: '/members/{id}/boards',
    summary: 'List the boards a member belongs to',
    params: {
      id: { in: 'path', type: 'string', required: true, description: 'me for the token owner' },
    },
  },
  {
    name: 'get-board',
    method: 'GET',
    path: '/boards/{id}',
    summary: 'Read one board',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-board-lists',
    method: 'GET',
    path: '/boards/{id}/lists',
    summary: 'List the lists of a board, with their ids',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-board-cards',
    method: 'GET',
    path: '/boards/{id}/cards',
    summary: 'List the cards of a board',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'list-list-cards',
    method: 'GET',
    path: '/lists/{id}/cards',
    summary: 'List the cards of a list',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'get-card',
    method: 'GET',
    path: '/cards/{id}',
    summary: 'Read one card',
    params: { id: { in: 'path', type: 'string', required: true } },
  },
  {
    name: 'create-card',
    method: 'POST',
    path: '/cards',
    summary: 'Create a card in a list',
    params: {
      idList: {
        in: 'query',
        type: 'string',
        required: true,
        description: 'The list the card goes in',
      },
      name: { in: 'query', type: 'string' },
      desc: { in: 'query', type: 'string' },
      pos: { in: 'query', type: 'string', description: 'top, bottom or a positive number' },
      due: { in: 'query', type: 'string', format: 'date-time' },
    },
  },
  {
    name: 'create-list',
    method: 'POST',
    path: '/lists',
    summary: 'Create a list on a board',
    params: {
      name: { in: 'query', type: 'string', required: true },
      idBoard: { in: 'query', type: 'string', required: true },
    },
  },
]

/**
 * Trello, authenticated with an API key and a token sent together in Trello's
 * OAuth-style Authorization header. The static header builder resolves every
 * `$env` reference inside `key`, so the one header carries both.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'trello',
  title: 'Trello boards and cards (API key and token)',
  category: 'productivity',
  tags: ['trello', 'kanban', 'boards', 'cards', 'tasks', 'webhook'],
  description:
    'Authenticated calls to the Trello REST API, with operations to read boards, lists and cards, create cards and lists, and register webhooks.',
  notes: [
    'Create a Power-Up in the Trello Power-Up admin portal to get an API key, generate a token for your account from it, and set them as `TRELLO_API_KEY` and `TRELLO_TOKEN`. Calls run as the account that generated the token.',
    'To start an automation from a board, a list or a card, call `create-webhook` with the address of a webhook automation as `callbackURL` and the id of what to watch as `idModel`; find ids with `list-member-boards` (`id: me`) and `list-board-lists`. Trello first sends a HEAD request to the address and creates the webhook only if it answers 200, then posts every action on the watched model as `{ action, model }`: keep the actions you want, for example `createCard`, with a filter step.',
  ],
  params: [],
  env: ['TRELLO_API_KEY', 'TRELLO_TOKEN'],
  requires: [],
  provider: {
    name: 'Trello',
    docsUrl: 'https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Trello',
    description: 'Trello REST API, authenticated with an API key and a token',
    props: {
      key: 'OAuth oauth_consumer_key="$env.TRELLO_API_KEY", oauth_token="$env.TRELLO_TOKEN"',
      header: 'Authorization',
    },
    baseUrl: 'https://api.trello.com/1',
    operations: OPERATIONS,
  }),
})
