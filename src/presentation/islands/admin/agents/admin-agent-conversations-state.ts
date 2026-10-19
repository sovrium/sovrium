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
import { useLazySharedFilter } from '../../hooks/use-lazy-shared-filter'
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
import type { SharedFilterBindingConfig } from '../../hooks/use-shared-filter'

/** Everything the island render needs from the conversation-viewer state. */
export interface AgentConversationsController {
  readonly list: ListState
  readonly thread: ThreadState
  readonly selectedId: string | undefined
  /** The term the page's search box published, already applied by the server. */
  readonly search: string
  readonly onResetSearch: () => void
  /** Leave the open thread for the list (below the medium breakpoint). */
  readonly onBack: () => void
  /** The agent filter value (`''` = all agents) + its setter. */
  readonly agent: string
  readonly setAgent: (value: string) => void
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly onSelect: (conversationId: string) => void
  readonly reloadList: () => void
  readonly reloadThread: () => void
}

/** From Tailwind's `md` breakpoint up, the list and the thread sit side by side. */
const SIDE_BY_SIDE = '(min-width: 48rem)'

/**
 * Clear the page's search box for the no-match state's Reset: the box is the
 * page's, not the viewer's, so it is emptied where it stands and its own input
 * event publishes the empty term on the channel, as a typed one would.
 */
function clearPublishedSearch(bindTo: string | undefined): void {
  if (bindTo === undefined) return
  const box = document.querySelector<HTMLInputElement>(
    `input[data-publishes-bind-to="${CSS.escape(bindTo)}"][data-publishes-param="q"]`
  )
  if (box === null) return
  box.value = ''
  box.dispatchEvent(new Event('input', { bubbles: true }))
}

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
 *
 * `dataSource` is the page binding every data component takes: with `bindTo` +
 * `sharedFilter`, what the page's composed controls publish on that channel (a
 * Person select's `userId`, a search box's `q`) joins every per-agent request.
 * The read waits for the channel to be read, so the first request is already
 * the narrowed one.
 */
function useConversationList(
  agentNames: ReadonlyArray<string>,
  dataSource: SharedFilterBindingConfig
): {
  readonly list: ListState
  readonly search: string
  readonly reloadList: () => void
} {
  const queryClient = useQueryClient()
  // Stable key component (the names array identity varies per render).
  const namesKey = agentNames.join(' ')
  const { extraParams: shared, ready } = useLazySharedFilter(dataSource, undefined)
  // The bag is rebuilt on every render; its serialisation is the stable key, so
  // the reload callback (and the bus subscription under it) only churns when
  // what the page publishes actually changes.
  const sharedKey = JSON.stringify(shared)
  const listKey = useMemo(
    () => ['admin-agent-conversations', 'list', namesKey, sharedKey] as const,
    [namesKey, sharedKey]
  )

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => loadAllConversations(namesKey ? namesKey.split(' ') : [], '', shared),
    enabled: ready,
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

  return { list, search: shared['q'] ?? '', reloadList }
}

/**
 * From the medium breakpoint up the newest conversation opens with the page,
 * and a selection the list no longer holds moves to its newest; below it,
 * nothing opens until a row is tapped, so a phone lands on the list.
 */
function useNewestOnWideScreens(
  list: ListState,
  selectedId: string | undefined,
  select: (id: string) => void
): void {
  useEffect(() => {
    const [newest] = list.conversations
    if (list.phase !== 'ready' || newest === undefined) return
    if (list.conversations.some((conversation) => conversation.id === selectedId)) return
    if (window.matchMedia(SIDE_BY_SIDE).matches) select(newest.id)
  }, [list, selectedId, select])
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
  agentNames: ReadonlyArray<string>,
  dataSource: SharedFilterBindingConfig
): AgentConversationsController {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  // The search box is the PAGE's, in its toolbar row: its term reaches the
  // list as `q` on the shared channel, never as island state.
  const { list, search, reloadList } = useConversationList(agentNames, dataSource)
  const [agent, setAgent] = useState('')
  const { thread, reloadThread } = useSelectedThread(list, selectedId)
  const onSelect = useCallback((conversationId: string) => setSelectedId(conversationId), [])
  useNewestOnWideScreens(list, selectedId, onSelect)
  const onBack = useCallback(() => setSelectedId(undefined), [])
  const { bindTo } = dataSource
  const onResetSearch = useCallback(() => clearPublishedSearch(bindTo), [bindTo])
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
    onResetSearch,
    onBack,
    agent,
    setAgent,
    visibleConversations,
    onSelect,
    reloadList,
    reloadThread,
  }
}
