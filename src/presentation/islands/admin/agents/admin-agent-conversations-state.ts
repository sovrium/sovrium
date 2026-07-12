/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export interface NewConversationState {
  readonly active: boolean
  readonly agent: string
  readonly composerKey: number
}

export interface AgentConversationsController {
  readonly list: ListState
  readonly thread: ThreadState
  readonly selectedId: string | undefined
  readonly search: string
  readonly setSearch: (value: string) => void
  readonly onResetSearch: () => void
  readonly agent: string
  readonly setAgent: (value: string) => void
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly onSelect: (conversationId: string) => void
  readonly reloadList: () => void
  readonly reloadThread: () => void
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
}

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

function useConversationList(agentNames: ReadonlyArray<string>): {
  readonly list: ListState
  readonly reloadList: () => void
} {
  const [list, setList] = useState<ListState>(LIST_LOADING)
  const namesKey = agentNames.join(' ')
  const reloadList = useCallback(() => {
    setList(LIST_LOADING)
    void loadAllConversations(namesKey ? namesKey.split(' ') : []).then(setList)
  }, [namesKey])
  useEffect(() => {
    reloadList()
  }, [reloadList])

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
