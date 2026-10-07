/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** The GraphQL mutation the recipe sends; its input comes from the variables. */
const ISSUE_CREATE =
  'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }'

/**
 * Each new record of one of the operator's tables becomes a Linear issue, in
 * one team, through the GraphQL operation of the Linear connection.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-linear-issue',
  title: 'Create a Linear issue for each new record',
  category: 'developer',
  tags: ['linear', 'issues', 'record', 'bug-report', 'developer'],
  description:
    'An automation that creates an issue in a Linear team each time a record is created in one of your tables.',
  notes: [
    "The automation runs when a record is created in the table named by `table` and creates an issue in the Linear team `teamId`, titled with the record's `titleField` and described with its `descriptionField`, through the `graphql` operation of the `linear` connection, which is installed with it. The issue is created as the owner of the API key.",
    'The team id is not the team key shown in issue identifiers: read it with the query `query { teams { nodes { id key name } } }` through the same connection. The description is Markdown, as in Linear itself.',
  ],
  params: [
    {
      name: 'teamId',
      description: 'The id of the Linear team the issues are created in.',
      type: 'string',
      required: true,
    },
    {
      name: 'table',
      description: 'The table whose new records become issues.',
      type: 'string',
      default: 'bug_reports',
    },
    {
      name: 'titleField',
      description: "The field used as the issue's title.",
      type: 'string',
      default: 'title',
    },
    {
      name: 'descriptionField',
      description: "The field used as the issue's description.",
      type: 'string',
      default: 'description',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'description', param: 'descriptionField', type: 'long-text' },
      ],
    },
  ],
  env: [],
  requires: ['connection/linear'],
  provider: {
    name: 'Linear',
    docsUrl: 'https://linear.app/developers/graphql',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'record',
      table: String(params['table'] ?? 'bug_reports'),
      events: ['create'],
    },
    actions: [
      {
        name: 'issue',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'linear',
          operation: 'graphql',
          params: {
            query: ISSUE_CREATE,
            variables: {
              input: {
                teamId: String(params['teamId'] ?? ''),
                title: `{{trigger.data.record.${String(params['titleField'] ?? 'title')}}}`,
                description: `{{trigger.data.record.${String(params['descriptionField'] ?? 'description')}}}`,
              },
            },
          },
        },
      },
    ],
  }),
})
