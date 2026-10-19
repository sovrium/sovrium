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
import { toolbarSearch } from '../../components/data-table-blocks'
import { toolbarFacet } from '../../components/toolbar-facet'
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
 * Drawn as a toolbar facet, like every filter of a control row. The resting
 * choice submits `''`, which the channel omits, so the viewer opens on everyone.
 */
const personFilter = (): PageComponent =>
  toolbarFacet({
    id: 'conversations-person-filter',
    label: '$t:admin.conversations.person',
    allLabel: '$t:admin.conversations.everyone',
    publishes: { bindTo: CONVERSATIONS_FILTER_CHANNEL, param: 'userId' },
    choices: {
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
    },
  })

/**
 * The Period facet: a relative window on each thread's last activity, sent as a
 * wire word (`period`) the server counts back from its own now — so the browser
 * computes no date, and a pinned development host answers on its pinned day.
 * It opens on All time: a default window would hide a person's older threads
 * from an operator auditing them.
 */
const periodFilter = (): PageComponent =>
  toolbarFacet({
    id: 'conversations-period-filter',
    label: '$t:admin.conversations.period',
    allLabel: '$t:admin.conversations.allTime',
    publishes: { bindTo: CONVERSATIONS_FILTER_CHANNEL, param: 'period' },
    choices: {
      options: [
        { value: '7d', label: '$t:admin.conversations.last7' },
        { value: '30d', label: '$t:admin.conversations.last30' },
        { value: '90d', label: '$t:admin.conversations.last90' },
      ],
    },
  })

/** The search box of the toolbar row, publishing `q` on the viewer's channel. */
const conversationSearch = (): PageComponent => {
  const box = toolbarSearch(CONVERSATIONS_FILTER_CHANNEL, '$t:admin.conversations.search') as {
    readonly props: Readonly<Record<string, unknown>>
  }
  return {
    ...box,
    props: { ...box.props, 'aria-label': '$t:admin.conversations.searchLabel' },
  } as PageComponent
}

/** The agent's conversations as CSV: the list read's `?format=csv`, saved as a file. */
const exportCsv = (agent: string): PageComponent =>
  ({
    type: 'button',
    label: '$t:admin.common.exportCsv',
    variant: 'outline',
    action: {
      type: 'fetch',
      mode: 'download',
      url: `/api/admin/agents/${agent}/conversations?format=csv`,
      filename: 'conversations.csv',
    },
    props: { className: 'sm:ml-auto' },
  }) as PageComponent

/**
 * The control row over the list: search, Person, Period and the export. A named
 * toolbar, like the records page's, so assistive technology announces the
 * row as one group of controls.
 */
const conversationToolbar = (agent: string): PageComponent => {
  const row = toolbarRow([
    conversationSearch(),
    personFilter(),
    periodFilter(),
    exportCsv(agent),
  ]) as { readonly props: Readonly<Record<string, unknown>> }
  return {
    ...row,
    props: { ...row.props, role: 'toolbar', 'aria-label': '$t:admin.conversations.toolbar' },
  } as PageComponent
}

/**
 * One fact of the agent header, shown only when the agent has it; an id reads in
 * mono. A fact that may run long (`fits: false`) gives way with an ellipsis and
 * carries its whole value as a tooltip; a short one keeps its width.
 */
const headerFact = (field: string, label: string, mono = true, fits = true): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: fits
        ? 'flex shrink-0 items-baseline gap-1.5'
        : 'flex min-w-0 items-baseline gap-1.5',
    },
    visibility: { record: { field, isNotEmpty: true } },
    children: [
      { type: 'text', element: 'span', props: { className: 'shrink-0' }, content: label },
      {
        type: 'text',
        element: 'span',
        props: {
          className: mono ? 'text-foreground font-mono text-xs' : 'text-foreground truncate',
          ...(fits ? {} : { title: `$record.${field}` }),
        },
        content: `$record.${field}`,
      },
    ],
  }) as PageComponent

/**
 * The agent's facts, in the top bar beside the trail whose last crumb already
 * names it (`GET /api/admin/agents/:name`, the page's record): how many
 * conversations it holds as a badge, then the model that answers it and the
 * actions it may call. The name is the trail's to draw; the header repeats it
 * only as the page's `h2`, spoken and not drawn, and the count's noun likewise.
 * Below `xl` the bar keeps the badge and drops the facts, which the open
 * thread's own badges carry.
 */
const agentHeader = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      'data-testid': 'agent-header',
      // Only the room the trail and the controls leave, and at most half the
      // bar: an agent with many tools (the built-in System agent lists two per
      // table) would otherwise push the trail and the read-only notice out.
      // Never narrower than the count: the facts beside it are contained
      // (`contain: inline-size`), so they ask for no width of their own and
      // take only what is left, ending in an ellipsis; below `xl`, where the
      // sidebar leaves the bar no room for them, they are not drawn at all.
      className: 'flex min-w-min max-w-1/2 flex-1 items-center gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'sr-only' },
        content: '$record.label',
      },
      {
        type: 'container',
        element: 'div',
        props: {
          'data-slot': 'badge',
          className:
            'bg-muted text-foreground inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-xs font-medium tabular-nums',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { 'data-testid': 'agent-conversation-count' },
            content: '$record.conversationCount',
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'sr-only' },
            content: '$t:admin.agents.header.conversations',
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'text-muted-foreground hidden min-w-0 flex-1 items-baseline gap-x-3 overflow-hidden text-sm [contain:inline-size] xl:flex',
        },
        children: [
          headerFact('model', '$t:admin.agents.header.model'),
          // The tools read for people (`Query clients`), not as ids.
          headerFact('toolLabels', '$t:admin.agents.header.tools', false, false),
        ],
      },
    ],
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
      // The label and model come from the page's record (the agent), substituted
      // into this serialised string like any other leaf.
      'data-island-props': `{"agentNames":["${agent}"],"agentLabel":"$record.label","agentModel":"$record.model","dataSource":{"bindTo":"${CONVERSATIONS_FILTER_CHANNEL}","sharedFilter":{"params":["userId","q","period"]}}}`,
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

/**
 * One agent's viewer page, differing only in its blurb and its bound name.
 *
 * The page is bound to the agent itself (`GET /api/admin/agents/:name`), so the
 * breadcrumb's last crumb, the header and the viewer's badges read its label
 * rather than its identifier — and a name the index does not list is the
 * console's own 404, as the reads behind it answer.
 *
 * The toolbar and the viewer sit in one named region, so the list's search box,
 * its facets and the list itself are found together.
 */
const viewerPage = (id: string, path: string, agent: string, blurb: string): PageConfig =>
  consolePage({
    id,
    path,
    title: '$t:admin.meta.agents',
    heading: ['$t:admin.agents.heading', blurb],
    page: {
      requires: ['agents'],
      dataSource: {
        system:
          agent === 'system'
            ? { endpoint: `${AGENTS_ENDPOINT}/system` }
            : { endpoint: `${AGENTS_ENDPOINT}/:agent`, param: 'agent' },
      },
    },
    shell: {
      breadcrumb: BREADCRUMB,
      breadcrumbCurrent: '$record.label',
      topbarFact: agentHeader(),
    },
    body: [
      fullWidth({
        type: 'container',
        element: 'section',
        props: { 'aria-label': '$t:admin.agents.viewer', className: 'flex min-w-0 flex-col gap-4' },
        children: [conversationToolbar(agent), conversationViewer(agent)],
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
