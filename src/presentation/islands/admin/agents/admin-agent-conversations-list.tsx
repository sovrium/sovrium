/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The conversation-LIST column of the `admin-agent-conversations` island — the
 * left column of the ChatGPT-style two-column viewer: a scrollable list of
 * conversation cards (title, then the person who held it, last activity and
 * message count), the selected one accented. The search box is the page's,
 * in its toolbar row. Its own loading / empty / no-match
 * / error states live here so the island stays a thin render under the per-island
 * `max-lines` cap. Click handlers are named (not inline) to avoid per-render
 * function allocation (react-perf).
 */

import { type ReactElement, useCallback } from 'react'
import { messageCountText, relativeTimeText } from './admin-agent-conversations-captions'
import { AgentFilter } from './admin-agent-conversations-controls'
import { type ConversationRow, type ListState } from './admin-agent-conversations-data'
import {
  ListLoading,
  ListErrorState,
  ListEmptyState,
  ListNoMatchState,
} from './admin-agent-conversations-states'

/** The row's trailing chevron, on a phone, where a tap opens the thread in its place. */
function RowChevron(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground shrink-0 @2xl:hidden"
    >
      <path d="m6 3.5 4.5 4.5-4.5 4.5" />
    </svg>
  )
}

/**
 * One conversation row: its title over the person who held it and its length,
 * the last activity at the row's end. The selected row is the muted one.
 */
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
  const facts = [conversation.userName, messageCountText(conversation.messageCount)].filter(
    (fact) => fact !== ''
  )
  return (
    <button
      type="button"
      data-testid={`agent-conversation-${conversation.id}`}
      aria-current={active ? 'true' : undefined}
      onClick={handleClick}
      className={[
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        active ? 'bg-muted' : 'hover:bg-muted/50',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground text-md truncate font-medium">{conversation.title}</span>
        {/* The person, then the length: the plural is the page language's
            (`Intl.PluralRules`), zero plural in English and singular in French.
            The agent is the URL's, so no row repeats it. */}
        <span className="text-muted-foreground truncate text-sm">{facts.join(' · ')}</span>
      </span>
      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
        {relativeTimeText(conversation.lastActivityAt)}
      </span>
      <RowChevron />
    </button>
  )
}

/** Props for the conversation-list column. */
interface ConversationListProps {
  readonly state: ListState
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly selectedId: string | undefined
  /** The page's published search term, for telling no match from no conversation. */
  readonly search: string
  readonly onSelect: (id: string) => void
  readonly onRetry: () => void
  readonly onResetSearch: () => void
  /** The agent filter value (`''` = all) + setter + the available agent names. */
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
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
    <div className="border-border divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
      {visibleConversations.map((conversation) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

/**
 * The conversation-list column: the agent filter, search, and the result list
 * with all its states, in a `region` named "Conversations". The console reads
 * a user's threads and starts none of its own, so the column offers no way to
 * begin one.
 */
export function ConversationList(props: ConversationListProps): ReactElement {
  // In a viewer narrower than 42rem an open thread REPLACES the list; from
  // 42rem up both stand (the container query is the island's `@container`).
  const shown = props.selectedId === undefined ? 'flex' : 'hidden @2xl:flex'
  return (
    <section
      aria-label="Conversations"
      className={`${shown} w-full flex-col gap-3 @2xl:w-80 @2xl:shrink-0`}
    >
      <AgentFilter
        agent={props.agent}
        onAgent={props.onAgent}
        agentNames={props.agentNames}
      />
      <ListBody {...props} />
    </section>
  )
}
