/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * Linear exposes one GraphQL endpoint, so the connection declares one
 * operation that sends a query and its variables.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'graphql',
    method: 'POST',
    path: '/graphql',
    summary: 'Run a query or a mutation of the Linear API',
    params: {
      query: { in: 'body', type: 'string', required: true, description: 'The GraphQL document' },
      variables: { in: 'body', type: 'object' },
      operationName: { in: 'body', type: 'string' },
    },
  },
]

/** Linear, authenticated with a personal API key. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'linear',
  title: 'Issue tracking with Linear (API key, GraphQL)',
  category: 'developer',
  tags: ['linear', 'issues', 'project-management', 'graphql', 'developer'],
  description: 'Authenticated calls to the Linear GraphQL API with a personal API key.',
  notes: [
    'Create a personal API key in Linear under Settings, Security and access, and set it as `LINEAR_API_KEY`. Linear expects the key itself in the `Authorization` header, with no `Bearer` word, which is how the connection sends it; calls act as you.',
    'The single `graphql` operation sends the query or mutation you write. `query { teams { nodes { id name } } }` gives the team ids that `issueCreate` needs, for example `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }` with `variables: { input: { teamId, title, description } }`.',
  ],
  params: [],
  env: ['LINEAR_API_KEY'],
  requires: [],
  provider: {
    name: 'Linear',
    docsUrl: 'https://linear.app/developers/graphql',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'apiKey',
    label: 'Linear',
    description: 'Linear GraphQL API, authenticated with a personal API key',
    props: { key: '$env.LINEAR_API_KEY', header: 'Authorization' },
    baseUrl: 'https://api.linear.app',
    operations: OPERATIONS,
  }),
})
