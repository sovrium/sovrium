/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `admin-agent-conversations` island state hook.
 * Owns the two fetch lifecycles — the merged all-agents conversation LIST and the
 * message THREAD for the selected conversation — plus the agent filter + a
 * client-side title search over the loaded list. Keeps the island a thin render
 * under the per-island `max-lines` cap. Selecting a conversation is island-local
 * state (the ChatGPT two-column layout lives inside one Data surface), so it does
 * not touch the URL.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribe } from '../../_shared/event-bus'
import {
  loadAllConversations,
  loadConversation,
  LIST_LOADING,
  THREAD_IDLE,
  THREAD_LOADING,
  type ConversationRow,
  type ListState,
  type ThreadState,
} from './admin-agent-conversations-data'

/**
 * The "New conversation" compose state. `agent` is `''`
 * until the operator picks one from the "Agent" combobox; once a non-empty
 * agent is picked the thread column swaps the idle prompt for the chat composer.
 * `composerKey` remounts the composer (fresh sessionId) per new conversation.
 */
export interface NewConversationState {
  readonly active: boolean
  readonly agent: string
  readonly composerKey: number
}

/** Everything the island render needs from the conversation-viewer state. */
export interface AgentConversationsController {
  readonly list: ListState
  readonly thread: ThreadState
  readonly selectedId: string | undefined
  readonly search: string
  readonly setSearch: (value: string) => void
  readonly onResetSearch: () => void
  /** The agent filter value (`''` = all agents) + its setter. */
  readonly agent: string
  readonly setAgent: (value: string) => void
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly onSelect: (conversationId: string) => void
  readonly reloadList: () => void
  readonly reloadThread: () => void
  /** The "New conversation" compose flow. */
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
}

/** Narrow the conversation list by the agent filter + a title/session search (client-side). */
function filterConversations(
  conversations: ReadonlyArray<ConversationRow>,
  agent: string,
  search: string
): ReadonlyArray<ConversationRow> {
  const needle = search.trim().toLowerCase()
  return conversations.filter((conversation) => {
    if (agent && conversation.agentName !== agent) return false
    if (!needle) return true
    return (
      conversation.title.toLowerCase().includes(needle) ||
      conversation.sessionId.toLowerCase().includes(needle)
    )
  })
}

/** Load + expose the merged all-agents conversation list with a manual reload. */
function useConversationList(agentNames: ReadonlyArray<string>): {
  readonly list: ListState
  readonly reloadList: () => void
} {
  const [list, setList] = useState<ListState>(LIST_LOADING)
  // Stable dependency for the load effect (the names array identity varies per render).
  const namesKey = agentNames.join(' ')
  const reloadList = useCallback(() => {
    setList(LIST_LOADING)
    void loadAllConversations(namesKey ? namesKey.split(' ') : []).then(setList)
  }, [namesKey])
  useEffect(() => {
    reloadList()
  }, [reloadList])

  // Reload when the composer reports a persisted round-trip for any of our
  // agents — the same event-bus refresh the bucket-files list uses after an
  // upload (CONV-013, no TanStack Query). The composer keys the event
  // `agent-conversation:${agentSlug}`.
  useEffect(() => {
    const names = new Set(namesKey ? namesKey.split(' ') : [])
    return subscribe('sovrium:crud-success', (detail) => {
      const prefix = 'agent-conversation:'
      if (!detail.table.startsWith(prefix)) return
      if (names.has(detail.table.slice(prefix.length))) reloadList()
    })
  }, [namesKey, reloadList])

  return { list, reloadList }
}

/**
 * The "New conversation" compose flow: a trigger that opens an agent
 * picker, picking an agent that opens the composer, and a `composerKey` bumped
 * on each new conversation so the composer remounts with a fresh sessionId.
 */
function useNewConversation(): {
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
  readonly cancelNewConversation: () => void
} {
  const [active, setActive] = useState(false)
  const [agent, setAgent] = useState('')
  const [composerKey, setComposerKey] = useState(0)
  const onStartNewConversation = useCallback(() => {
    setAgent('')
    setComposerKey((k) => k + 1)
    setActive(true)
  }, [])
  const onPickNewAgent = useCallback((value: string) => setAgent(value), [])
  const cancelNewConversation = useCallback(() => {
    setActive(false)
    setAgent('')
  }, [])
  return {
    newConversation: { active, agent, composerKey },
    onStartNewConversation,
    onPickNewAgent,
    cancelNewConversation,
  }
}

/** Load the message thread for the selected conversation (scoped to its owning agent). */
function useSelectedThread(
  list: ListState,
  selectedId: string | undefined
): { readonly thread: ThreadState; readonly reloadThread: () => void } {
  const [thread, setThread] = useState<ThreadState>(THREAD_IDLE)
  const selectedAgent = useMemo(
    () => list.conversations.find((c) => c.id === selectedId)?.agentName,
    [list.conversations, selectedId]
  )
  const reloadThread = useCallback(() => {
    if (!selectedAgent || !selectedId) return
    setThread(THREAD_LOADING)
    void loadConversation(selectedAgent, selectedId).then(setThread)
  }, [selectedAgent, selectedId])
  useEffect(() => {
    if (selectedId) reloadThread()
  }, [selectedId, reloadThread])
  return { thread, reloadThread }
}

/**
 * Drive the agent conversation viewer: load ALL agents' conversations merged
 * newest-first, narrow by the agent filter + search, then load a thread on
 * selection (the selected row carries its owning agent, so the thread fetch is
 * scoped to the right agent). [internal ref]: all conversations by default, no
 * left-rail agent picker.
 */
export function useAgentConversations(
  agentNames: ReadonlyArray<string>
): AgentConversationsController {
  const { list, reloadList } = useConversationList(agentNames)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [agent, setAgent] = useState('')
  const { thread, reloadThread } = useSelectedThread(list, selectedId)
  const { newConversation, onStartNewConversation, onPickNewAgent, cancelNewConversation } =
    useNewConversation()

  // Picking an existing conversation leaves the compose flow (the thread column
  // shows the selected transcript, not the composer).
  const onSelect = useCallback(
    (conversationId: string) => {
      cancelNewConversation()
      setSelectedId(conversationId)
    },
    [cancelNewConversation]
  )
  const onResetSearch = useCallback(() => setSearch(''), [])
  const visibleConversations = useMemo(
    () => filterConversations(list.conversations, agent, search),
    [list.conversations, agent, search]
  )

  return {
    list,
    thread,
    selectedId,
    search,
    setSearch,
    onResetSearch,
    agent,
    setAgent,
    visibleConversations,
    onSelect,
    reloadList,
    reloadThread,
    newConversation,
    onStartNewConversation,
    onPickNewAgent,
  }
}
