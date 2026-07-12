/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import { ChatComposer } from './admin-agent-chat-composer'
import { ConversationList } from './admin-agent-conversations-list'
import {
  useAgentConversations,
  type AgentConversationsController,
} from './admin-agent-conversations-state'
import { ConversationThread } from './admin-agent-conversations-thread'

interface AdminAgentConversationsIslandProps {
  readonly agentNames?: ReadonlyArray<string>
}

const EMPTY_NAMES: ReadonlyArray<string> = []

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

export default function AdminAgentConversationsIsland({
  agentNames = EMPTY_NAMES,
}: AdminAgentConversationsIslandProps): ReactElement {
  const ctl = useAgentConversations(agentNames)
  return (
    <div className="flex flex-wrap gap-6">
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
        className="min-w-0 flex-1"
      >
        <ThreadColumn ctl={ctl} />
      </section>
    </div>
  )
}
