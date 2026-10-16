/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `admin-agent-conversations` island — the ChatGPT-style conversation history
 * viewer that backs the agents Data surface (`/_admin/agents`,
 * [internal ref], Pass 2b of the pure operational data console).
 *
 * Composes the two admin read endpoints
 * (`GET /api/admin/agents/:name/conversations` — cursor-paginated newest-first
 * list, and `GET /api/admin/agents/:name/conversations/:id` — the message thread)
 * into a read-only two-column viewer: a conversation LIST column (an AGENT filter
 * + search + cards with the agent name, last-activity + message count) and a
 * message THREAD column (the selected conversation's transcript). [internal ref]:
 * the list defaults to ALL agents' conversations merged newest-first, narrowed by
 * the agent filter — there is no left-rail agent picker. No sending — operators
 * observe, they don't reply.
 *
 * The state lifecycle lives in the `-state` hook; the list / thread columns + the
 * pure data/format helpers in the `-list` / `-thread` / `-data` modules, so this
 * island stays a thin render under the per-island `max-lines` cap.
 */

import { type ReactElement } from 'react'
import { ChatComposer } from './admin-agent-chat-composer'
import { ConversationList } from './admin-agent-conversations-list'
import {
  useAgentConversations,
  type AgentConversationsController,
} from './admin-agent-conversations-state'
import { AgentConversationStringsContext } from './admin-agent-conversations-strings'
import { ConversationThread } from './admin-agent-conversations-thread'
import type { SharedFilterBindingConfig } from '../../hooks/use-shared-filter'

/** @public Stub consumer (shadcn parity plan §9.1): a lazy edge to @shadcn/react until the conversation port. */
// eslint-disable-next-line react-refresh/only-export-components -- a lazy loader, not a component
export const loadMessageScrollerPrimitives = () => import('../../parts/message-scroller-primitives')

interface AdminAgentConversationsIslandProps {
  /** The operator's agent names — the conversations are merged across all of them. */
  readonly agentNames?: ReadonlyArray<string>
  /**
   * The page binding the data components take: `bindTo` names the channel the
   * page's composed controls publish on, `sharedFilter.params` the keys read
   * from it (`userId`, `q`). Inert without both.
   */
  readonly dataSource?: SharedFilterBindingConfig
  /** The viewer's words in the console language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}

const EMPTY_NAMES: ReadonlyArray<string> = []
const UNBOUND: SharedFilterBindingConfig = {}
const ENGLISH: Readonly<Record<string, string>> = {}

/**
 * The thread column body: the "New conversation" composer when the compose
 * flow is active with a picked agent, otherwise the selected
 * conversation's read-only transcript (the default observe-only viewer). The
 * composer is keyed by `composerKey` so each new conversation remounts it with a
 * fresh sessionId.
 */
function ThreadColumn({ ctl }: { readonly ctl: AgentConversationsController }): ReactElement {
  const { active, agent, composerKey } = ctl.newConversation
  if (active && agent.length > 0) {
    return (
      <ChatComposer
        key={composerKey}
        agentSlug={agent}
      />
    )
  }
  return (
    <ConversationThread
      state={ctl.thread}
      onRetry={ctl.reloadThread}
    />
  )
}

/** The agent conversation-viewer surface region (two columns: list + thread). */
export default function AdminAgentConversationsIsland({
  agentNames = EMPTY_NAMES,
  dataSource = UNBOUND,
  uiStrings = ENGLISH,
}: AdminAgentConversationsIslandProps): ReactElement {
  const ctl = useAgentConversations(agentNames, dataSource)
  // Below `md` the two panes stack, the list first: side by side, the thread
  // was squeezed into whatever a phone had left beside a 288 px list.
  return (
    <AgentConversationStringsContext.Provider value={uiStrings}>
      <div className="flex flex-col gap-6 md:flex-row">
        <ConversationList
          state={ctl.list}
          visibleConversations={ctl.visibleConversations}
          selectedId={ctl.selectedId}
          search={ctl.search}
          onSearch={ctl.setSearch}
          onSelect={ctl.onSelect}
          onRetry={ctl.reloadList}
          onResetSearch={ctl.onResetSearch}
          agent={ctl.agent}
          onAgent={ctl.setAgent}
          agentNames={agentNames}
          newConversation={ctl.newConversation}
          onStartNewConversation={ctl.onStartNewConversation}
          onPickNewAgent={ctl.onPickNewAgent}
        />
        <section
          aria-label="Conversation"
          className="w-full min-w-0 md:flex-1"
        >
          <ThreadColumn ctl={ctl} />
        </section>
      </div>
    </AgentConversationStringsContext.Provider>
  )
}
