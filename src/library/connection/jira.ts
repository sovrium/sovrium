/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Issues of the Jira Cloud platform REST API v3. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-issue',
    method: 'POST',
    path: '/issue',
    summary: 'Create an issue',
    params: {
      fields: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ project: { key }, issuetype: { name }, summary, description, labels }',
      },
    },
  },
  {
    name: 'get-issue',
    method: 'GET',
    path: '/issue/{issueIdOrKey}',
    summary: 'Read an issue',
    params: {
      issueIdOrKey: { in: 'path', type: 'string', required: true, description: 'e.g. OPS-42' },
      fields: { in: 'query', type: 'string', description: 'Comma-separated field names' },
    },
  },
  {
    name: 'search-issues',
    method: 'GET',
    path: '/search/jql',
    summary: 'Find issues with a JQL query',
    params: {
      jql: { in: 'query', type: 'string', required: true, description: 'e.g. project = OPS' },
      fields: { in: 'query', type: 'string' },
      maxResults: { in: 'query', type: 'integer' },
      nextPageToken: { in: 'query', type: 'string' },
    },
    pagination: {
      style: 'cursor',
      cursorParam: 'nextPageToken',
      cursorPath: 'nextPageToken',
      itemsPath: 'issues',
    },
  },
  {
    name: 'add-comment',
    method: 'POST',
    path: '/issue/{issueIdOrKey}/comment',
    summary: 'Comment on an issue',
    params: {
      issueIdOrKey: { in: 'path', type: 'string', required: true },
      body: {
        in: 'body',
        type: 'object',
        required: true,
        description: 'The comment as an Atlassian Document Format object',
      },
    },
  },
]

/** Jira Cloud, authenticated with an Atlassian account email and API token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'jira',
  title: 'Issue tracking with Jira Cloud (API token)',
  category: 'developer',
  tags: ['jira', 'atlassian', 'issues', 'tickets', 'project-management', 'developer'],
  description:
    'Authenticated calls to the Jira Cloud REST API, with operations to create, read, search and comment on issues.',
  notes: [
    "Create an API token for your Atlassian account at id.atlassian.com, under Security, API tokens. Set your account email as `JIRA_EMAIL`, the token as `JIRA_API_TOKEN` and your site address, such as `https://mycompany.atlassian.net`, as `JIRA_BASE_URL`; the connection sends the email and token with HTTP Basic and acts with that account's permissions.",
    "Version 3 of the API writes rich text — an issue's `description`, a comment's `body` — in Atlassian Document Format, a JSON object, not plain text. An issue is created with only `project`, `issuetype` and `summary` when its other fields are optional in that project.",
  ],
  params: [],
  env: ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  requires: [],
  provider: {
    name: 'Atlassian Jira Cloud',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'basic',
    label: 'Jira',
    description: 'Jira Cloud REST API, authenticated with an account email and API token',
    props: { username: '$env.JIRA_EMAIL', password: '$env.JIRA_API_TOKEN' },
    baseUrl: '$env.JIRA_BASE_URL/rest/api/3',
    operations: OPERATIONS,
  }),
})
