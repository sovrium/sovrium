/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Conversations** page — Pass 2b of
 * the pure operational data console.
 *
 * `/_admin/data/agents` opens a two-pane workspace: a left rail of the operator's
 * declared AI agents (`app.agents`) + a right pane with the selected agent's
 * ChatGPT-style conversation viewer. Picking an agent
 * (`/_admin/data/agents/{name}`) mounts the `admin-agent-conversations` island — a
 * read-only two-column viewer (a conversation list + the selected conversation's
 * message thread) over the agent-scoped admin read endpoints
 * (`GET /api/admin/agents/:name/conversations` and `.../conversations/:id`).
 *
 * Selection is a path segment, so it is URL-derived — back/forward + the SPA
 * content swap + the sidebar's active-row highlight compose for free, no separate
 * client state. When the operator declares no agents the page shows an honest
 * whole-page empty state (there is nothing to pick) rather than an empty rail.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageEmptyState, dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** An operator agent (the conversation-source name list). */
type OperatorAgent = App['agents'] extends ReadonlyArray<infer T> | undefined ? T : never

/** The declared agent names — the agents whose conversations the viewer merges. */
function agentNames(agents: ReadonlyArray<OperatorAgent>): ReadonlyArray<string> {
  return agents.flatMap((agent): ReadonlyArray<string> => {
    const { name } = agent as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Conversations',
    'Review the conversation history between your users and your AI agents. By default every conversation is listed — filter by agent, then open one to read its messages.'
  )
}

/**
 * The conversation-viewer body: the `admin-agent-conversations` island host
 * carrying ALL agent names (the viewer merges every agent's conversations and
 * filters by agent — [internal ref]). The SSR skeleton ships the "Conversations"
 * landmark so the static fallback is queryable before hydration.
 */
function conversationViewerBody(names: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-4',
      'data-island': 'admin-agent-conversations',
      'data-island-props': JSON.stringify({ agentNames: names }),
    },
    children: [
      {
        type: 'container',
        element: 'section',
        props: { 'aria-label': 'Conversations', className: 'flex flex-col gap-2' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-foreground-subtle px-1 py-2 text-sm' },
            content: 'Loading conversations…',
          },
        ],
      },
    ],
  } as unknown as Component
}

/**
 * Build the Conversations page. The viewer defaults to ALL
 * agents' conversations merged newest-first, with an agent filter in the list
 * column — there is no left-rail agent picker. When the operator declares no
 * agents the whole page is an honest empty state. The `object` route segment is
 * ignored (agent selection is now a filter, not a path).
 */
export function buildDataAgentsPage(
  operatorApp: App,
  _object: string | undefined,
  options: DataShellOptions
): Page {
  const agents = (operatorApp.agents ?? []) as ReadonlyArray<OperatorAgent>
  const names = agentNames(agents)
  const body =
    names.length === 0
      ? dataPageEmptyState(
          'No agents',
          'This app declares no AI agents. Declare an agent in your config (app.agents) for it to appear here with its conversations.',
          'Configuration lives in code — conversations follow.'
        )
      : conversationViewerBody(names)

  return {
    id: 'dashboard-data-agents',
    name: 'dashboard-data-agents',
    path: '/agents',
    meta: { title: 'Sovrium — Data · Conversations' },
    components: wrapInShell([intro(), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Conversations', href: '/_admin/agents' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
