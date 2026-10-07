/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const REPO = {
  owner: { in: 'path', type: 'string', required: true },
  repo: { in: 'path', type: 'string', required: true },
} as const

/** Issues and pull requests of the GitHub REST API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-issue',
    method: 'POST',
    path: '/repos/{owner}/{repo}/issues',
    summary: 'Open an issue in a repository',
    params: {
      ...REPO,
      title: { in: 'body', type: 'string', required: true },
      body: { in: 'body', type: 'string' },
      labels: { in: 'body', type: 'array', items: { type: 'string' } },
      assignees: { in: 'body', type: 'array', items: { type: 'string' } },
    },
  },
  {
    name: 'list-issues',
    method: 'GET',
    path: '/repos/{owner}/{repo}/issues',
    summary: 'List the issues of a repository',
    params: {
      ...REPO,
      state: { in: 'query', type: 'string', enum: ['open', 'closed', 'all'] },
      labels: { in: 'query', type: 'string', description: 'Comma-separated label names' },
      per_page: { in: 'query', type: 'integer' },
    },
    pagination: { style: 'link' },
  },
  {
    name: 'create-issue-comment',
    method: 'POST',
    path: '/repos/{owner}/{repo}/issues/{issue_number}/comments',
    summary: 'Comment on an issue or a pull request',
    params: {
      ...REPO,
      issue_number: { in: 'path', type: 'integer', required: true },
      body: { in: 'body', type: 'string', required: true },
    },
  },
  {
    name: 'list-pull-requests',
    method: 'GET',
    path: '/repos/{owner}/{repo}/pulls',
    summary: 'List the pull requests of a repository',
    params: {
      ...REPO,
      state: { in: 'query', type: 'string', enum: ['open', 'closed', 'all'] },
      per_page: { in: 'query', type: 'integer' },
    },
    pagination: { style: 'link' },
  },
]

/** GitHub, authenticated with a fine-grained personal access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'github',
  title: 'Code hosting with GitHub (access token)',
  category: 'developer',
  tags: ['github', 'git', 'issues', 'pull-requests', 'developer'],
  description:
    'Authenticated calls to the GitHub REST API, with operations for issues, comments and pull requests.',
  notes: [
    'Create a fine-grained personal access token in GitHub under Settings, Developer settings, limited to the repositories the app works on, with read and write access to Issues and read access to Pull requests. Set it as `GITHUB_TOKEN`. This is a connection your automations call; signing people in with GitHub is configured separately, under authentication.',
    "The listings page through the `Link` header; call them with `paginate: all` to read every page. A token from an organization's repositories may need an owner of the organization to approve it first.",
  ],
  params: [],
  env: ['GITHUB_TOKEN'],
  requires: [],
  provider: {
    name: 'GitHub',
    docsUrl: 'https://docs.github.com/en/rest/issues/issues',
    verifiedOn: '2026-10-06',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'GitHub',
    description: 'GitHub REST API, authenticated with a personal access token',
    props: { token: '$env.GITHUB_TOKEN' },
    baseUrl: 'https://api.github.com',
    operations: OPERATIONS,
  }),
})
