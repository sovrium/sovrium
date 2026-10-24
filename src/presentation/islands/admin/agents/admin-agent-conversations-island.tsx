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

import { type ReactElement, useMemo } from 'react'
import { ConversationList } from './admin-agent-conversations-list'
import { useAgentConversations } from './admin-agent-conversations-state'
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
  /** The agent as the console names it — an answer's author and the thread's badge. */
  readonly agentLabel?: string
  /** The model the agent answers with, for a thread whose answers named none. */
  readonly agentModel?: string
}

const EMPTY_NAMES: ReadonlyArray<string> = []
const UNBOUND: SharedFilterBindingConfig = {}
const ENGLISH: Readonly<Record<string, string>> = {}

/** The agent conversation-viewer surface region (two columns: list + thread). */
export default function AdminAgentConversationsIsland({
  agentNames = EMPTY_NAMES,
  dataSource = UNBOUND,
  uiStrings = ENGLISH,
  agentLabel = '',
  agentModel = '',
}: AdminAgentConversationsIslandProps): ReactElement {
  const ctl = useAgentConversations(agentNames, dataSource)
  const names = useMemo(() => ({ agentLabel, agentModel }), [agentLabel, agentModel])
  // Where the viewer is narrower than 42rem the list and an open thread
  // REPLACE each other: the list until a row is tapped, then the thread, whose
  // back control returns. From 42rem up they stand side by side. The width is
  // the viewer's own (`@container`), not the window's: at 768px the console's
  // sidebar leaves the page 512px, too little for two columns.
  const thread = ctl.selectedId === undefined ? 'hidden @2xl:block' : 'block'
  // An agent nobody has talked to has nothing to read: the list's own empty
  // state is the whole answer, so no reader pane stands beside it saying
  // "Select a conversation" about a list with none in it. A search that
  // matched nothing keeps the pane — the agent HAS conversations.
  const quiet =
    ctl.list.phase === 'ready' &&
    ctl.list.conversations.length === 0 &&
    ctl.search.trim().length === 0
  return (
    <AgentConversationStringsContext.Provider value={uiStrings}>
      <div className="@container">
        <div className="flex flex-col gap-6 @2xl:flex-row">
          <ConversationList
            state={ctl.list}
            visibleConversations={ctl.visibleConversations}
            selectedId={ctl.selectedId}
            search={ctl.search}
            onSelect={ctl.onSelect}
            onRetry={ctl.reloadList}
            onResetSearch={ctl.onResetSearch}
            agent={ctl.agent}
            onAgent={ctl.setAgent}
            agentNames={agentNames}
            alone={quiet}
          />
          {quiet ? null : (
            <section
              aria-label="Conversation"
              className={`${thread} w-full min-w-0 @2xl:flex-1`}
            >
              <ConversationThread
                state={ctl.thread}
                onRetry={ctl.reloadThread}
                onBack={ctl.onBack}
                names={names}
              />
            </section>
          )}
        </div>
      </div>
    </AgentConversationStringsContext.Provider>
  )
}
