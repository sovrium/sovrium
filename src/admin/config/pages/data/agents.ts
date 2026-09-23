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
//   `/agents`          the bare collection, which always 302s — there is always
//                      a first agent, because the reserved general-purpose
//                      `default` leads the projection.
//   `/agents/default`  the general-purpose agent, whose viewer holds every
//                      conversation no declared agent claimed.
//   `/agents/:agent`   one declared agent's viewer.
//
// ─── WHY `default` IS ITS OWN PAGE AND NOT A BRANCH ────────────────────────
//
// The two differ by ONE sentence — the orienting blurb has to say what the
// general-purpose agent IS, and that sentence is false for a declared agent.
// Config has no way to branch a body on a route parameter: `visibility.condition`
// reads `$user.*`, not `$param.*`, and widening it to route state would make a
// component's presence depend on the URL rather than on who is asking, which is a
// different primitive with a different security surface.
//
// Route ORDER answers it instead, at no cost: `findMatchingRoute` takes the
// first pattern that matches, with no static-over-dynamic precedence, so a
// literal page listed BEFORE the `:agent` page wins `/agents/default` and the
// param page never sees it. Order is therefore load-bearing here in a way it is
// not on the other surfaces — reversing these two silently deletes the sentence.
//
// The blurb is worded from the ROW (`agent_name IS NULL`), not from the caller's
// intent, and stays that way even though the two now agree. They did not always:
// `POST /api/ai/chat { agent: 'x' }` used to persist NULL despite naming a
// declared agent. This copy names what the operator will actually find in the
// list, and that stays true whatever a future transport does.

import { fullWidth, pageHeading } from '../../components/data-page'
import { withShell } from '../../components/shell'
import { AGENTS_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The Conversations crumb label, shared by all three pages of the surface. */
const BREADCRUMB = { agents: '$t:admin.crumb.agents' } as const

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
      'data-island-props': `{"agentNames":["${agent}"]}`,
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
  withShell(
    {
      id,
      name: id,
      path,
      meta: { title: '$t:admin.meta.agents', lang: 'en-US' },
      components: [
        pageHeading('$t:admin.agents.heading', blurb),
        fullWidth(conversationViewer(agent)),
      ],
    } as PageConfig,
    { breadcrumb: BREADCRUMB }
  )

/**
 * The agent list `redirectToFirst` reads its first row from.
 *
 * The same endpoint and key the sidebar's Conversations disclosure lazy-loads,
 * and the same name projection the viewer pages are addressed by — one
 * projection, two consumers, so the sidebar cannot advertise an agent whose page
 * 404s nor omit one that opens.
 *
 * It never paints: the projection leads with the reserved `default`, so the
 * redirect always resolves. It stands as the honest fallback for a failed read.
 */
const agentDirectory = (): PageComponent =>
  ({
    type: 'list',
    props: { 'data-testid': 'admin-agents-directory', className: 'flex flex-col gap-1' },
    dataSource: { system: { endpoint: AGENTS_ENDPOINT, rowsKey: 'items' } },
    listDisplay: {
      itemTemplate: { title: '{name}' },
      emptyMessage: 'No agents',
    },
  }) as PageComponent

/** `/agents` — the bare collection, which always redirects. */
const directoryPage: PageConfig = withShell(
  {
    id: 'dashboard-data-agents',
    name: 'dashboard-data-agents',
    path: '/agents',
    meta: { title: '$t:admin.meta.agents', lang: 'en-US' },
    redirectToFirst: { hrefTemplate: '/agents/{name}' },
    components: [pageHeading('$t:admin.agents.heading', '$t:admin.agents.blurb'), agentDirectory()],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
)

/**
 * All three pages, with the LITERAL `/agents/default` ahead of `/agents/:agent`.
 *
 * That order is the whole mechanism behind the general-purpose agent's own
 * blurb. See the header note before reordering.
 */
export default [
  directoryPage,
  viewerPage(
    'dashboard-data-agents-default',
    '/agents/default',
    'default',
    '$t:admin.agents.blurbDefault'
  ),
  viewerPage(
    'dashboard-data-agents-agent',
    '/agents/:agent',
    '$param.agent',
    '$t:admin.agents.blurb'
  ),
] satisfies readonly PageConfig[]
