/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

const PAGING = {
  status: {
    in: 'query',
    type: 'string',
    description: 'open, completed, completed_archived or trashed',
  },
  items: { in: 'query', type: 'integer', description: 'Items per page' },
  page: { in: 'query', type: 'integer' },
  sort: { in: 'query', type: 'string', description: 'An attribute, - for descending: -created_at' },
} as const

/** Projects, sections and tasks of the MeisterTask REST API. */
const OPERATIONS: LibraryOperations = [
  {
    name: 'list-projects',
    method: 'GET',
    path: '/projects',
    summary: 'List the projects you can see',
    params: { ...PAGING },
  },
  {
    name: 'list-sections',
    method: 'GET',
    path: '/sections',
    summary: 'List the sections of every project',
    params: { ...PAGING },
  },
  {
    name: 'list-project-sections',
    method: 'GET',
    path: '/projects/{project_id}/sections',
    summary: 'List the sections of a project',
    params: { project_id: { in: 'path', type: 'integer', required: true }, ...PAGING },
  },
  {
    name: 'create-section',
    method: 'POST',
    path: '/projects/{project_id}/sections',
    summary: 'Create a section in a project',
    params: {
      project_id: { in: 'path', type: 'integer', required: true },
      name: { in: 'body', type: 'string', required: true },
    },
  },
  {
    name: 'list-tasks',
    method: 'GET',
    path: '/tasks',
    summary: 'List every task you can see',
    params: { ...PAGING },
  },
  {
    name: 'list-project-tasks',
    method: 'GET',
    path: '/projects/{project_id}/tasks',
    summary: 'List the tasks of a project',
    params: { project_id: { in: 'path', type: 'string', required: true }, ...PAGING },
  },
  {
    name: 'list-section-tasks',
    method: 'GET',
    path: '/sections/{section_id}/tasks',
    summary: 'List the tasks of a section',
    params: { section_id: { in: 'path', type: 'integer', required: true }, ...PAGING },
  },
  {
    name: 'get-task',
    method: 'GET',
    path: '/tasks/{id}',
    summary: 'Read one task',
    params: { id: { in: 'path', type: 'integer', required: true } },
  },
  {
    name: 'create-task',
    method: 'POST',
    path: '/sections/{section_id}/tasks',
    summary: 'Create a task in a section',
    params: {
      section_id: { in: 'path', type: 'integer', required: true },
      name: { in: 'body', type: 'string', required: true },
      notes: { in: 'body', type: 'string' },
      due: { in: 'body', type: 'string', format: 'date-time' },
      assigned_to_id: { in: 'body', type: 'string' },
      status: { in: 'body', type: 'integer' },
      label_ids: { in: 'body', type: 'array', items: { type: 'integer' } },
    },
  },
]

/** MeisterTask, authenticated with a personal access token. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'meistertask',
  title: 'Tasks with MeisterTask (personal access token)',
  category: 'productivity',
  tags: ['meistertask', 'tasks', 'projects', 'kanban'],
  description:
    'Authenticated calls to the MeisterTask API, with operations to read projects, sections and tasks and to create sections and tasks.',
  notes: [
    'Create a personal access token in your MeisterTask account settings with the `userinfo.profile`, `userinfo.email` and `meistertask` scopes, and set it as `MEISTERTASK_TOKEN`. Calls run as the person who created it.',
    'MeisterTask sends no webhooks, so new tasks are read on a schedule: run `list-section-tasks` (or `list-project-tasks`) from an automation with a `cron` trigger, with `sort: -created_at` and `items` set, and keep only the task ids it has not seen yet.',
  ],
  params: [],
  env: ['MEISTERTASK_TOKEN'],
  requires: [],
  provider: {
    name: 'MeisterTask',
    docsUrl: 'https://developers.meistertask.com/reference/authentication',
    verifiedOn: '2026-10-20',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'MeisterTask',
    description: 'MeisterTask API, authenticated with a personal access token',
    props: { token: '$env.MEISTERTASK_TOKEN' },
    baseUrl: 'https://www.meistertask.com/api',
    operations: OPERATIONS,
  }),
})
