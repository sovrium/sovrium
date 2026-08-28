/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Conversations** page — an
 * Application-section object page of the pure operational data console.
 *
 * Conversations is scoped by URL, exactly like Files: `/_admin/agents/{name}`
 * opens ONE agent's ChatGPT-style viewer, and a bare `/_admin/agents` 302s to
 * the first agent. There is always a first agent — `declaredAgentNames` leads
 * with the reserved general-purpose `default`, whose view is the conversations
 * no declared agent claimed — so the page can never be a whole-page empty
 * state, and the old "No agents" body it used to render is unreachable.
 *
 * The name projection is shared verbatim with `GET /api/admin/agents`, which is
 * what the sidebar disclosure lazy-loads. One projection, two consumers: the
 * sidebar cannot advertise an agent whose page 404s, nor omit one that opens.
 *
 * Selection being a path segment makes it URL-derived — back/forward + the SPA
 * content swap + the sidebar's active-row highlight compose for free, with no
 * separate client state.
 */

import { declaredAgentNames, isDefaultAgentName } from '@/domain/utils/agent-identity'
import { objectScopedPage, firstObjectRedirect, dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { DataObjectRedirect } from './data-object-rail'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The page intro: heading + orienting one-liner, scoped to the SELECTED agent.
 *
 * "no declared agent claimed" is worded from the ROW (`agent_name IS NULL`),
 * not from the caller's intent, and stays that way even though the two now
 * agree. They did not always: `POST /api/ai/chat { agent: 'x' }` used to
 * persist NULL despite naming a declared agent, which is why this sentence
 * describes the row in the first place. Attribution is now transport-independent
 *, so the sets coincide.
 *
 * Kept row-worded regardless: this copy names what the operator will actually
 * find in the list, and that stays true whatever a future transport does with
 * the caller's `agent` field. Re-wording it from intent would re-couple the
 * user-facing sentence to a behaviour that has already changed once.
 */
function intro(selected: string): Component {
  return dataPageIntro(
    'Conversations',
    isDefaultAgentName(selected)
      ? 'The general-purpose agent: every conversation no declared agent claimed. Open one to read the full thread.'
      : 'Every conversation your users had with this agent. Open one to read the full thread.'
  )
}

/**
 * The conversation-viewer body: the `admin-agent-conversations` island host
 * carrying the agent names in scope — now exactly ONE, the selected agent,
 * because scoping moved from an in-pane filter to the URL.
 *
 * That single-element list is also what retires the in-pane "Agent" filter with
 * no UI branch: the island's `AgentFilter` already returns `null` below two
 * names, so the affordance disappears rather than lingering as a one-option
 * select that cannot change anything. The SSR skeleton ships the
 * "Conversations" landmark so the static fallback is queryable before hydration.
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
 * Build the Conversations page — or a 302 redirect to the first agent.
 *
 * A bare `/_admin/agents` ALWAYS returns a {@link DataObjectRedirect} to the
 * first agent's viewer: `declaredAgentNames` is never empty, so there is always
 * a first agent. With a `selected` agent the body mounts that agent's viewer.
 *
 * The `Page` is assembled by {@link objectScopedPage} rather than by hand, which
 * is what fixes the render-404: the dashboard route matches `Page.path` against
 * the stripped path, and a hand-written `path: '/agents'` meant a request for
 * `/_admin/agents/{name}` parsed fine and then matched nothing.
 */
export function buildDataAgentsPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const names = declaredAgentNames(operatorApp.agents)

  // Bare object-page path → 302-redirect to the first agent's viewer (always
  // present: the reserved `default` leads the projection).
  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('agents', names[0])
  }

  const agent = selected ?? names[0]!
  return objectScopedPage(
    { key: 'agents', label: 'Conversations', intro: intro(agent) },
    agent,
    conversationViewerBody([agent]),
    options
  )
}
