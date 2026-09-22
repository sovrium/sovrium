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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { subscribe } from '../../runtime/event-bus'
import { READ_ONCE_QUERY_OPTIONS } from '../../runtime/query-client'
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

/**
 * How long the search box waits before asking the server.
 *
 * The box had NO debounce while it filtered in memory, where a keystroke cost
 * nothing. It now fans a request out to every declared agent, so an undebounced
 * box would issue one request per agent per keystroke. 300 ms matches the
 * data-table's own search default (`search.debounceMs ?? 300`) so the two
 * search boxes in the console feel the same.
 */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Narrow the merged list by the AGENT filter only.
 *
 * The title/sessionId half of this predicate is gone: the server now applies it
 * (`?q=` over `title` + `sessionId`), and re-applying it here would re-impose
 * the very ceiling the server fix removed — a thread found beyond the 200-row
 * window would be fetched and then dropped again on the way to the screen.
 * Exactly one layer filters, and for those two fields it is the server.
 *
 * The agent filter legitimately stays client-side: it partitions a list already
 * merged from per-agent responses, so no request can express it.
 */
function filterConversations(
  conversations: ReadonlyArray<ConversationRow>,
  agent: string
): ReadonlyArray<ConversationRow> {
  if (!agent) return conversations
  return conversations.filter((conversation) => conversation.agentName === agent)
}

/**
 * Load + expose the merged all-agents conversation list with a manual reload.
 *
 * `search` is a REQUEST parameter here, not a post-filter: it is threaded into
 * every per-agent fetch, so changing it re-reads rather than re-narrowing.
 */
function useConversationList(
  agentNames: ReadonlyArray<string>,
  search: string
): {
  readonly list: ListState
  readonly reloadList: () => void
} {
  const queryClient = useQueryClient()
  // Stable key component (the names array identity varies per render).
  const namesKey = agentNames.join(' ')
  const listKey = useMemo(
    () => ['admin-agent-conversations', 'list', namesKey, search] as const,
    [namesKey, search]
  )

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => loadAllConversations(namesKey ? namesKey.split(' ') : [], search),
    ...READ_ONCE_QUERY_OPTIONS,
  })

  // A reload REPLACES the list with the loading state rather than leaving the
  // old rows up under a spinner — that was the explicit `setList(LIST_LOADING)`
  // ahead of every load, and it is what makes a search that narrows to nothing
  // read as "searching" instead of as stale results. `isFetching` reproduces it
  // for a refetch; a changed key has no data of its own, so it falls out.
  const list: ListState = listQuery.isFetching ? LIST_LOADING : (listQuery.data ?? LIST_LOADING)

  const reloadList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: listKey })
  }, [queryClient, listKey])

  // Reload when the composer reports a persisted round-trip for any of our
  // agents — the same event-bus refresh the bucket-files list uses after an
  // upload (CONV-013). The composer keys the event `agent-conversation:${agentSlug}`.
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
function useNewConversation(agentNames: ReadonlyArray<string>): {
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
  readonly cancelNewConversation: () => void
} {
  // With exactly one agent in scope there is nothing to pick: preselect it so
  // "New conversation" opens straight onto the composer. Starting empty made
  // the operator re-choose the agent whose page they were already on — the
  // composer stayed hidden behind a one-option `select` until they did. (The
  // conversation FILTER hides itself below two agents; this is the compose
  // PICKER, a different control, and it was still rendering.)
  const soleAgent = agentNames.length === 1 ? (agentNames[0] ?? '') : ''
  const [active, setActive] = useState(false)
  const [agent, setAgent] = useState(soleAgent)
  const [composerKey, setComposerKey] = useState(0)
  const onStartNewConversation = useCallback(() => {
    setAgent(soleAgent)
    setComposerKey((k) => k + 1)
    setActive(true)
  }, [soleAgent])
  const onPickNewAgent = useCallback((value: string) => setAgent(value), [])
  const cancelNewConversation = useCallback(() => {
    setActive(false)
    setAgent(soleAgent)
  }, [soleAgent])
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
  const queryClient = useQueryClient()
  const selectedAgent = useMemo(
    () => list.conversations.find((c) => c.id === selectedId)?.agentName,
    [list.conversations, selectedId]
  )
  const enabled = Boolean(selectedAgent && selectedId)
  const threadKey = useMemo(
    () => ['admin-agent-conversations', 'thread', selectedAgent, selectedId] as const,
    [selectedAgent, selectedId]
  )

  const threadQuery = useQuery({
    queryKey: threadKey,
    // Guarded by `enabled`; the non-null assertions are unreachable when it is false.
    queryFn: () => loadConversation(selectedAgent ?? '', selectedId ?? ''),
    enabled,
    ...READ_ONCE_QUERY_OPTIONS,
  })

  // Three states, and the third is why `enabled` is read before the data: a
  // DISABLED query is `pending` too, so "no data" alone would paint the thread
  // column as loading when nothing is selected, instead of as the idle prompt.
  const thread: ThreadState = !enabled
    ? THREAD_IDLE
    : threadQuery.isFetching
      ? THREAD_LOADING
      : (threadQuery.data ?? THREAD_LOADING)

  const reloadThread = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: threadKey })
  }, [queryClient, threadKey])

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
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  // Two search values, deliberately. `search` is what the operator sees in the
  // box and updates on every keystroke; `debouncedSearch` is what reaches the
  // network. Binding the fetch straight to `search` would fan one request per
  // declared agent out on every character typed.
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const { list, reloadList } = useConversationList(agentNames, debouncedSearch)
  const [agent, setAgent] = useState('')
  const { thread, reloadThread } = useSelectedThread(list, selectedId)
  const { newConversation, onStartNewConversation, onPickNewAgent, cancelNewConversation } =
    useNewConversation(agentNames)

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
  // Agent partitioning only — the term was already applied by the server on the
  // way in (see `filterConversations`).
  const visibleConversations = useMemo(
    () => filterConversations(list.conversations, agent),
    [list.conversations, agent]
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
