/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Conversations — every thread your users had with an agent, one viewer per agent.
//
// THREE pages, and the third is the interesting one:
//
//   `/conversations`          the bare collection, which always 302s — there is always
//                      a first agent, because the built-in `system` agent
//                      leads the projection.
//   `/conversations/system`   the built-in System Agent, whose viewer holds every
//                      conversation no declared agent claimed.
//   `/conversations/:agent`   one declared agent's viewer.
//
// ─── WHY `system` IS ITS OWN PAGE AND NOT A BRANCH ─────────────────────────
//
// The two differ by ONE sentence — the orienting blurb has to say what the
// System Agent IS, and that sentence is false for a declared agent.
// Config has no way to branch a body on a route parameter: `visibility.condition`
// reads `$user.*`, not `$param.*`, and widening it to route state would make a
// component's presence depend on the URL rather than on who is asking, which is a
// different primitive with a different security surface.
//
// Route ORDER answers it instead, at no cost: `findMatchingRoute` takes the
// first pattern that matches, with no static-over-dynamic precedence, so a
// literal page listed BEFORE the `:agent` page wins `/conversations/system` and the
// param page never sees it. Order is therefore load-bearing here in a way it is
// not on the other surfaces — reversing these two silently deletes the sentence.
//
// The blurb is worded from the ROW (`agent_name IS NULL`), not from the caller's
// intent, and stays that way even though the two now agree. They did not always:
// `POST /api/ai/chat { agent: 'x' }` used to persist NULL despite naming a
// declared agent. This copy names what the operator will actually find in the
// list, and that stays true whatever a future transport does.

import { consolePage, fullWidth, toolbarRow } from '../../components/data-page'
import { AGENTS_ENDPOINT, USERS_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The Conversations crumb label, shared by all three pages of the surface. */
const BREADCRUMB = { conversations: '$t:admin.crumb.conversations' } as const

/**
 * The shared-filter channel the Person select publishes on and the viewer
 * island subscribes to. A plain name no element owns, the same mechanism as the
 * run-history filter bar on Automations.
 */
const CONVERSATIONS_FILTER_CHANNEL = 'conversations-filter'

/**
 * The Person facet: who had the conversation, narrowing the list by `userId`.
 *
 * Its choices are the ACCOUNT DIRECTORY, not the conversations read. The
 * option projection does not de-duplicate, so reading people off the threads
 * would list someone once per conversation; and a page of threads would only
 * offer the people who happen to be on it. The directory names each account
 * once, sorted by name, up to the endpoint's page ceiling. Someone with no
 * conversation with this agent can still be picked, and the viewer then says
 * so with its own empty state, which is an honest answer rather than a gap.
 *
 * The caption sits INLINE, so the row stays the 40 px control row: the label
 * wraps the control, which makes "Person" the control's accessible name, and
 * the caption's own bottom margin (written for a caption above) is cancelled;
 * the control takes the rest of the label's width, which is full on a phone
 * and bounded from `sm` up so it never stretches across the content column.
 * The empty choice submits `''`, which the channel omits, so the viewer opens
 * on everyone.
 */
const personFilter = (): PageComponent =>
  ({
    type: 'native-select',
    props: {
      id: 'conversations-person-filter',
      label: '$t:admin.conversations.person',
      className:
        'flex w-full items-center gap-2 sm:w-72 [&>[data-slot=label]]:mb-0 [&>[data-slot=label]]:shrink-0 [&>[data-slot=native-select-wrapper]]:min-w-0 [&>[data-slot=native-select-wrapper]]:flex-1',
    },
    emptyOption: { label: '$t:admin.conversations.everyone' },
    publishes: { bindTo: CONVERSATIONS_FILTER_CHANNEL, param: 'userId' },
    dataSource: {
      system: {
        endpoint: USERS_ENDPOINT,
        rowsKey: 'users',
        idKey: 'id',
        query: { limit: 200, sort: 'name', order: 'asc' },
      },
      valueKey: 'id',
      labelKey: 'name',
    },
  }) as PageComponent

/**
 * The conversation viewer, scoped to ONE agent.
 *
 * The island is handed a single-element `agentNames` list, and that is what
 * retires the in-pane "Agent" filter with no UI branch: the island's own filter
 * returns nothing below two names, so the affordance disappears rather than
 * lingering as a one-option select that cannot change anything.
 *
 * `data-island-props` is a SERIALISED string, and `$param` substitution walks
 * string leaves — so the route segment reaches the island through the JSON it is
 * already handed, with no per-island plumbing. The SSR skeleton ships the
 * "Conversations" landmark so the static fallback is queryable before hydration.
 */
const conversationViewer = (agent: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-4',
      'data-island': 'admin-agent-conversations',
      'data-island-props': `{"agentNames":["${agent}"],"dataSource":{"bindTo":"${CONVERSATIONS_FILTER_CHANNEL}","sharedFilter":{"params":["userId","q"]}}}`,
    },
    children: [
      {
        type: 'container',
        element: 'section',
        props: { 'aria-label': '$t:admin.agents.region', className: 'flex flex-col gap-2' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-foreground-subtle px-1 py-2 text-md' },
            content: '$t:admin.agents.loading',
          },
        ],
      },
    ],
  }) as PageComponent

/** One agent's viewer page, differing only in its blurb and its bound name. */
const viewerPage = (id: string, path: string, agent: string, blurb: string): PageConfig =>
  consolePage({
    id,
    path,
    title: '$t:admin.meta.agents',
    heading: ['$t:admin.agents.heading', blurb],
    page: {
      requires: ['agents'],
    },
    shell: { breadcrumb: BREADCRUMB },
    body: [
      fullWidth({
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-2' },
        children: [toolbarRow([personFilter()]), conversationViewer(agent)],
      } as PageComponent),
    ],
  })

/**
 * The agent list `redirectToFirst` reads its first row from.
 *
 * The same endpoint and key the sidebar's Conversations disclosure lazy-loads,
 * and the same name projection the viewer pages are addressed by — one
 * projection, two consumers, so the sidebar cannot advertise an agent whose page
 * 404s nor omit one that opens.
 *
 * It never paints: the projection leads with the built-in `system` agent, so the
 * redirect always resolves. It stands as the honest fallback for a failed read.
 */
const agentDirectory = (): PageComponent =>
  ({
    type: 'list',
    props: { 'data-testid': 'admin-agents-directory', className: 'flex flex-col gap-1' },
    dataSource: { system: { endpoint: AGENTS_ENDPOINT, rowsKey: 'items' } },
    listDisplay: {
      itemTemplate: { title: '{name}' },
      emptyMessage: '$t:admin.agents.none',
    },
  }) as PageComponent

/** `/conversations` — the bare collection, which always redirects. */
const directoryPage: PageConfig = consolePage({
  id: 'dashboard-data-agents',
  path: '/conversations',
  title: '$t:admin.meta.agents',
  heading: ['$t:admin.agents.heading', '$t:admin.agents.blurb'],
  page: {
    requires: ['agents'],
    redirectToFirst: { hrefTemplate: '/conversations/{name}' },
  },
  shell: { breadcrumb: BREADCRUMB },
  body: [agentDirectory()],
})

/**
 * All three pages, with the LITERAL `/conversations/system` ahead of `/conversations/:agent`.
 *
 * That order is the whole mechanism behind the System Agent's own
 * blurb. See the header note before reordering.
 */
export default [
  directoryPage,
  viewerPage(
    'dashboard-data-agents-system',
    '/conversations/system',
    'system',
    '$t:admin.agents.blurbSystem'
  ),
  viewerPage(
    'dashboard-data-agents-agent',
    '/conversations/:agent',
    '$param.agent',
    '$t:admin.agents.blurb'
  ),
] satisfies readonly PageConfig[]
