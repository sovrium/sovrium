/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each new record of one of the operator's tables earns its author points: a
 * row is added to a points ledger table the operator owns, naming the member,
 * the points and the reason. Installed once per activity — a post, a reply, a
 * completed lesson — each with its own amount, the ledger is what the
 * `leaderboard-points` block ranks.
 *
 * A ledger of rows rather than a running total: a row per event needs no
 * read-then-write (two activities at the same instant both count), keeps the
 * history a dispute needs, and lets a leaderboard sum any period.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-points',
  title: 'Award points for each new record',
  category: 'community',
  tags: ['points', 'gamification', 'leaderboard', 'community', 'record'],
  description:
    'An automation that adds a row to your points ledger each time a member creates a record in one of your tables.',
  notes: [
    'The automation runs when a signed-in member creates a record in the table named by `table`, and adds a row to the ledger table named by `ledger`: the member’s account id (`member`) and name (`member_name`), the `points` it is worth, a `reason` quoting the record’s `titleField`, and when it was earned. A record no signed-in person wrote — a guest’s, or one another automation created — earns nothing.',
    'Install it once per activity, each under its own name and amount, for instance `sovrium library add recipe/record-to-points --as points-for-posts --set table=posts --set points=10` and `--as points-for-lessons --set table=lesson_completions --set points=50 --set reason="Lesson completed"`.',
    'A member’s points are the sum of their ledger rows. Rank members with the `leaderboard-points` block, and show a level with a rollup or formula field on your members table over the ledger.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table whose new records earn points.',
      type: 'string',
      default: 'posts',
    },
    {
      name: 'titleField',
      description: 'The field of that table quoted in the ledger row’s reason.',
      type: 'string',
      default: 'title',
    },
    {
      name: 'ledger',
      description: 'The points ledger table rows are added to.',
      type: 'string',
      default: 'points',
    },
    {
      name: 'points',
      description: 'How many points one new record earns.',
      type: 'number',
      default: 10,
    },
    {
      name: 'reason',
      description: 'The reason written on each ledger row.',
      type: 'string',
      default: 'New post',
    },
  ],
  tables: [
    { param: 'table', fields: [{ name: 'title', param: 'titleField', type: 'single-line-text' }] },
    {
      param: 'ledger',
      fields: [
        { name: 'member', type: 'single-line-text' },
        { name: 'member_name', type: 'single-line-text' },
        { name: 'points', type: 'integer' },
        { name: 'reason', type: 'single-line-text' },
        { name: 'earned_at', type: 'datetime' },
      ],
    },
  ],
  env: [],
  requires: [],
  provider: {
    name: 'Sovrium',
    docsUrl: 'https://sovrium.com/en/docs',
    verifiedOn: '2026-10-24',
  },
  build: ({ name, params }) => {
    const table = String(params['table'] ?? 'posts')
    const ledger = String(params['ledger'] ?? 'points')
    const titleField = String(params['titleField'] ?? 'title')
    return {
      name,
      trigger: { type: 'record', table, events: ['create'] },
      actions: [
        {
          name: 'onlyMembers',
          type: 'filter',
          operator: 'continue',
          props: {
            condition: {
              conditions: [
                // A guest's write carries no user: it earns nothing either.
                { field: '{{trigger.user.id}}', operator: 'isNotEmpty' },
                { field: '{{trigger.user.id}}', operator: 'notEquals', value: 'system' },
              ],
            },
          },
        },
        {
          name: 'award',
          type: 'record',
          operator: 'create',
          props: {
            table: ledger,
            data: {
              member: '{{trigger.user.id}}',
              member_name: '{{trigger.user.name}}',
              points: Number(params['points'] ?? 10),
              reason: `${String(params['reason'] ?? 'New post')}: {{trigger.data.record.${titleField}}}`,
              earned_at: '{{trigger.data.record.createdAt}}',
            },
          },
        },
      ],
    }
  },
})
