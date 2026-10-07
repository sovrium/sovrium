/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const PROJECT = {
  id: {
    in: 'path',
    type: 'string',
    required: true,
    description: 'The project id, or its path such as group/project',
  },
} as const

/** Issues and merge requests of the GitLab REST API v4. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-issue',
    method: 'POST',
    path: '/projects/{id}/issues',
    summary: 'Open an issue in a project',
    params: {
      ...PROJECT,
      title: { in: 'body', type: 'string', required: true },
      description: { in: 'body', type: 'string' },
      labels: { in: 'body', type: 'string', description: 'Comma-separated label names' },
      assignee_ids: { in: 'body', type: 'array', items: { type: 'integer' } },
    },
  },
  {
    name: 'list-issues',
    method: 'GET',
    path: '/projects/{id}/issues',
    summary: 'List the issues of a project',
    params: {
      ...PROJECT,
      state: { in: 'query', type: 'string', enum: ['opened', 'closed', 'all'] },
      labels: { in: 'query', type: 'string' },
      per_page: { in: 'query', type: 'integer' },
    },
    pagination: { style: 'link' },
  },
  {
    name: 'create-issue-note',
    method: 'POST',
    path: '/projects/{id}/issues/{issue_iid}/notes',
    summary: 'Comment on an issue',
    params: {
      ...PROJECT,
      issue_iid: { in: 'path', type: 'integer', required: true },
      body: { in: 'body', type: 'string', required: true },
    },
  },
  {
    name: 'list-merge-requests',
    method: 'GET',
    path: '/projects/{id}/merge_requests',
    summary: 'List the merge requests of a project',
    params: {
      ...PROJECT,
      state: { in: 'query', type: 'string', enum: ['opened', 'closed', 'locked', 'merged', 'all'] },
      per_page: { in: 'query', type: 'integer' },
    },
    pagination: { style: 'link' },
  },
]

/** GitLab, on gitlab.com or your own instance, with an access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'gitlab',
  title: 'Code hosting with GitLab (access token)',
  category: 'developer',
  tags: ['gitlab', 'git', 'issues', 'merge-requests', 'developer', 'self-hosted'],
  description:
    'Authenticated calls to the GitLab REST API on gitlab.com or a self-managed instance, with operations for issues and merge requests.',
  notes: [
    'Create a project or group access token — or a personal one — with the `api` scope and set it as `GITLAB_TOKEN`. For a self-managed GitLab, install with `--set host=https://gitlab.example.com`. This is a connection your automations call; signing people in with GitLab is configured separately, under authentication.',
    'A project is named by its numeric id or by its full path, such as `my-group/my-project`, which Sovrium encodes in the address. Issues are addressed by `issue_iid`, the number shown in GitLab, not by their global id. The listings page through the `Link` header; call them with `paginate: all` to read every page.',
  ],
  params: [
    {
      name: 'host',
      description: 'The address of your GitLab: gitlab.com or your own instance.',
      type: 'string',
      default: 'https://gitlab.com',
    },
  ],
  env: ['GITLAB_TOKEN'],
  requires: [],
  provider: {
    name: 'GitLab',
    docsUrl: 'https://docs.gitlab.com/api/issues/',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    type: 'bearer',
    label: 'GitLab',
    description: 'GitLab REST API, authenticated with an access token',
    props: { token: '$env.GITLAB_TOKEN' },
    baseUrl: `${String(params['host'] ?? 'https://gitlab.com').replace(/\/+$/, '')}/api/v4`,
    operations: OPERATIONS,
  }),
})
