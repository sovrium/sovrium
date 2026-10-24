/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Scheduled email broadcasts: on a schedule, every broadcast whose send time
 * has passed is mailed to the members of a segment as a bulk send of one
 * category, under a campaign named after the broadcast, and the counts are
 * written back on the broadcast row.
 *
 * "Due" compares `send_at` with the run's own time (`{{now}}`): a record filter
 * takes no `$now` token. Inside the members loop the broadcast is read through
 * its loop's name (`loops.sendEach.item`), since `loop.item` is the member.
 */
type Step = Readonly<Record<string, unknown>>

/** The filter naming the current loop item's row. */
const BY_ID = { conditions: [{ field: 'id', operator: 'equals', value: '{{loop.item.id}}' }] }

/** A `record/list` of `table` under these conditions. */
const listStep = (name: string, table: string, conditions: readonly Step[]): Step => ({
  name,
  type: 'record',
  operator: 'list',
  props: { table, filter: { conditions } },
})

/** A `record/update` of the current loop item's row. */
const updateStep = (name: string, table: string, data: Step): Step => ({
  name,
  type: 'record',
  operator: 'update',
  props: { table, filter: BY_ID, data },
})

/** `email/stats` for the current loop item's broadcast. */
const statsStep = (name: string): Step => ({
  name,
  type: 'email',
  operator: 'stats',
  props: { campaign: 'broadcast-{{loop.item.id}}' },
})

/** A `loop/each` over `items`, each item failing alone. */
const loopStep = (name: string, items: string, actions: readonly Step[]): Step => ({
  name,
  type: 'loop',
  operator: 'each',
  props: { items, continueOnItemError: true, actions },
})

/** One member's copy of the broadcast: a bulk send of `category` under its campaign. */
const mailStep = (category: string): Step => ({
  name: 'mail',
  type: 'email',
  operator: 'send',
  props: {
    to: '{{loop.item.email}}',
    subject: '{{loops.sendEach.item.subject}}',
    body: '{{loops.sendEach.item.body}}',
    category,
    campaign: 'broadcast-{{loops.sendEach.item.id}}',
  },
})

/** Mark each due broadcast `sending` first (never sent twice), mail the segment, mark it `sent`. */
const sendEachStep = (table: string, category: string): Step =>
  loopStep('sendEach', '{{due.records}}', [
    updateStep('markSending', table, { status: 'sending' }),
    loopStep('mailSegment', '{{segment.records}}', [mailStep(category)]),
    statsStep('count'),
    updateStep('markSent', table, { status: 'sent', sent_count: '{{count.sent}}' }),
  ])

/** Refresh the four counts of the broadcasts sent in the last 30 days. */
const refreshEachStep = (table: string): Step =>
  loopStep('refreshEach', '{{recent.records}}', [
    statsStep('counts'),
    updateStep('writeCounts', table, {
      sent_count: '{{counts.sent}}',
      opened_count: '{{counts.opened}}',
      bounced_count: '{{counts.bounced}}',
      unsubscribed_count: '{{counts.unsubscribed}}',
    }),
  ])

export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'scheduled-broadcast',
  title: 'Send scheduled email broadcasts to a segment',
  category: 'communication',
  tags: ['email', 'newsletter', 'broadcast', 'campaign', 'schedule', 'unsubscribe'],
  description:
    'An automation that mails each due broadcast to a segment of your members as a bulk campaign, with one-click unsubscribe, and writes its sent, opened, bounced and unsubscribed counts back on the broadcast.',
  notes: [
    'Every run (every 15 minutes by default, `schedule`) lists the broadcasts of `table` whose `status` is `scheduled` and whose `send_at` has passed. Each is marked `sending` before anything is mailed, so a second run never sends it twice, then mailed to every member of `members` whose `segmentField` is checked, as a bulk send of `category` with the campaign `broadcast-<id>`, and marked `sent` with its `sent_count`.',
    'Members who unsubscribed from the category, or whose address bounced or complained, are skipped and not counted. Each run also refreshes the four counts of the broadcasts sent in the last 30 days.',
    'Open counts need `trackOpens`, off by default: turn it on in the installed send step if your privacy notice says so.',
  ],
  params: [
    {
      name: 'schedule',
      description: 'When the automation runs (cron).',
      type: 'string',
      default: '*/15 * * * *',
    },
    { name: 'table', description: 'The broadcasts table.', type: 'string', default: 'broadcasts' },
    { name: 'members', description: 'The members table.', type: 'string', default: 'members' },
    {
      name: 'segmentField',
      description: 'The checkbox field of the members table marking who receives broadcasts.',
      type: 'string',
      default: 'newsletter',
    },
    {
      name: 'category',
      description: 'The mailing-list category of the broadcasts.',
      type: 'string',
      default: 'newsletter',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'subject', type: 'single-line-text' },
        { name: 'body', type: 'long-text' },
        { name: 'send_at', type: 'datetime' },
        { name: 'status', type: 'single-line-text' },
        { name: 'sent_count', type: 'integer' },
        { name: 'opened_count', type: 'integer' },
        { name: 'bounced_count', type: 'integer' },
        { name: 'unsubscribed_count', type: 'integer' },
      ],
    },
    {
      param: 'members',
      fields: [
        { name: 'email', type: 'email' },
        { name: 'newsletter', param: 'segmentField', type: 'checkbox' },
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
    const table = String(params['table'] ?? 'broadcasts')
    const segmentField = String(params['segmentField'] ?? 'newsletter')
    return {
      name,
      trigger: { type: 'cron', expression: String(params['schedule'] ?? '*/15 * * * *') },
      actions: [
        listStep('due', table, [
          { field: 'status', operator: 'equals', value: 'scheduled' },
          { field: 'send_at', operator: 'lessThanOrEqual', value: '{{now}}' },
        ]),
        listStep('segment', String(params['members'] ?? 'members'), [
          { field: segmentField, operator: 'equals', value: true },
        ]),
        sendEachStep(table, String(params['category'] ?? 'newsletter')),
        listStep('recent', table, [
          { field: 'status', operator: 'equals', value: 'sent' },
          { field: 'send_at', operator: 'greaterThanOrEqual', value: '{{subtractDays (now) 30}}' },
        ]),
        refreshEachStep(table),
      ],
    }
  },
})
