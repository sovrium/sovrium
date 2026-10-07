/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The conversation-LIST column of the `admin-agent-conversations` island — the
 * left column of the ChatGPT-style two-column viewer. A search box over the
 * loaded titles + a scrollable list of conversation cards (title + last-activity
 * + message count), the selected one accented. Its own loading / empty / no-match
 * / error states live here so the island stays a thin render under the per-island
 * `max-lines` cap. Click handlers are named (not inline) to avoid per-render
 * function allocation (react-perf).
 */

import { type ReactElement, useCallback } from 'react'
import { NewConversation, AgentFilter, ListSearch } from './admin-agent-conversations-controls'
import {
  formatRelative,
  type ConversationRow,
  type ListState,
} from './admin-agent-conversations-data'
import {
  ListLoading,
  ListErrorState,
  ListEmptyState,
  ListNoMatchState,
} from './admin-agent-conversations-states'
import type { NewConversationState } from './admin-agent-conversations-state'

/** One conversation card in the list, the selected one accented. */
function ConversationCard({
  conversation,
  active,
  onSelect,
}: {
  readonly conversation: ConversationRow
  readonly active: boolean
  readonly onSelect: (id: string) => void
}): ReactElement {
  const handleClick = useCallback(() => onSelect(conversation.id), [onSelect, conversation.id])
  return (
    <button
      type="button"
      data-testid={`agent-conversation-${conversation.id}`}
      aria-current={active ? 'true' : undefined}
      onClick={handleClick}
      className={[
        'flex w-full flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
        active
          ? 'text-foreground-muted border-border-strong/40 bg-background-subtle'
          : 'text-foreground-muted hover:border-border hover:bg-background-subtle border-transparent',
      ].join(' ')}
    >
      <span className="text-foreground text-md truncate font-medium">{conversation.title}</span>
      {/* The agent name used to lead this line, from when the list merged every
          agent. Scoped to one agent by the URL, it repeated the breadcrumb, the
          sidebar's active row and the page heading on every row — four times for
          one fact. Dropped; `agentName` stays on the row because the transcript
          fetch is agent-scoped and still needs it. */}
      <span className="text-foreground-subtle flex items-center gap-2 text-sm">
        <span>{formatRelative(conversation.lastActivityAt)}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {/* `> 1` rendered an empty thread as "0 message". Zero is plural. */}
          {conversation.messageCount} message{conversation.messageCount === 1 ? '' : 's'}
        </span>
      </span>
    </button>
  )
}

/** Props for the conversation-list column. */
interface ConversationListProps {
  readonly state: ListState
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly selectedId: string | undefined
  readonly search: string
  readonly onSearch: (value: string) => void
  readonly onSelect: (id: string) => void
  readonly onRetry: () => void
  readonly onResetSearch: () => void
  /** The agent filter value (`''` = all) + setter + the available agent names. */
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
  /** The "New conversation" compose flow. */
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
}

/** Resolve the list body from the load phase + the search outcome. */
function ListBody(props: ConversationListProps): ReactElement {
  const { state, visibleConversations, selectedId, onSelect, onRetry, onResetSearch } = props
  if (state.phase === 'loading') return <ListLoading />
  if (state.phase === 'error') return <ListErrorState onRetry={onRetry} />
  // Search runs SERVER-side, so an empty response while a term is active means
  // "no matches", not "no conversations". Deciding the empty state on row count
  // alone told an operator with 221 seeded threads that no user had ever talked
  // to their agents — a confident wrong answer of exactly the kind this change
  // set out to remove. The empty state is only honest with no term applied.
  const searching = props.search.trim().length > 0
  if (!searching && state.conversations.length === 0) return <ListEmptyState />
  if (visibleConversations.length === 0)
    return (
      <ListNoMatchState
        query={props.search.trim()}
        onResetSearch={onResetSearch}
      />
    )
  return (
    <>
      {visibleConversations.map((conversation) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

/**
 * The conversation-list column: the "New conversation" trigger, the agent
 * filter, search, and the result list with all its states. A `region` named
 * "Conversations" — the new-conversation flow and the result cards both live
 * inside it (CONV-013 reads the list region + its conversation buttons).
 */
export function ConversationList(props: ConversationListProps): ReactElement {
  return (
    <section
      aria-label="Conversations"
      className="border-border flex w-72 shrink-0 flex-col gap-3 border-r pr-4"
    >
      <NewConversation
        state={props.newConversation}
        agentNames={props.agentNames}
        onStart={props.onStartNewConversation}
        onPickAgent={props.onPickNewAgent}
      />
      <AgentFilter
        agent={props.agent}
        onAgent={props.onAgent}
        agentNames={props.agentNames}
        hidden={props.newConversation.active}
      />
      <ListSearch
        search={props.search}
        onSearch={props.onSearch}
      />
      <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        <ListBody {...props} />
      </div>
    </section>
  )
}
