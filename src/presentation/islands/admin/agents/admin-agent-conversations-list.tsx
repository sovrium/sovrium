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

import { type ChangeEvent, type ReactElement, useCallback } from 'react'
import {
  formatRelative,
  type ConversationRow,
  type ListState,
} from './admin-agent-conversations-data'
import type { NewConversationState } from './admin-agent-conversations-state'

/**
 * The "New conversation" trigger + agent picker. The
 * "New conversation" button opens an "Agent" combobox; picking an agent
 * opens the composer in the thread column. The picker only renders once the
 * compose flow is active so the empty starting state is a single clean CTA.
 */
function NewConversation({
  state,
  agentNames,
  onStart,
  onPickAgent,
}: {
  readonly state: NewConversationState
  readonly agentNames: ReadonlyArray<string>
  readonly onStart: () => void
  readonly onPickAgent: (value: string) => void
}): ReactElement {
  const handlePick = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onPickAgent(event.target.value),
    [onPickAgent]
  )
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onStart}
        className="text-foreground-muted border-border-strong/40 bg-background-subtle hover:bg-background-subtle/70 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <span
          aria-hidden="true"
          className="text-base leading-none"
        >
          +
        </span>
        New conversation
      </button>
      {state.active ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground-subtle text-xs">Agent</span>
          <select
            aria-label="Agent"
            value={state.agent}
            onChange={handlePick}
            className="border-border bg-background text-foreground flex-1 rounded-md border px-2 py-1 text-sm"
          >
            <option value="">Choose an agent…</option>
            {agentNames.map((name) => (
              <option
                key={name}
                value={name}
              >
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : undefined}
    </div>
  )
}

/**
 * The agent filter above the conversation list. Defaults to
 * "All agents" (value `''`); selecting an agent narrows the merged list to
 * that agent's conversations. Hidden when there are fewer than two agents to
 * choose between. Mirrors the native-select pattern used elsewhere.
 *
 * Campaign 4A made the agent a URL segment, so the surface now mounts this
 * island with a SINGLE-element `agentNames` and the `< 2` guard hides the
 * control on every real render. It is kept rather than deleted because it is the
 * one code path: the island still filters by agent internally, and a future
 * merged view (or a spec mounting several names) gets the control back for free
 * instead of needing it rebuilt.
 */
function AgentFilter({
  agent,
  onAgent,
  agentNames,
  hidden,
}: {
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
  /** Hidden while the "New conversation" picker is open, so only one "Agent"-ish combobox exists. */
  readonly hidden: boolean
}): ReactElement | null {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onAgent(event.target.value),
    [onAgent]
  )
  // eslint-disable-next-line unicorn/no-null -- React conditional needs null, not undefined
  if (agentNames.length < 2 || hidden) return null
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-foreground-subtle text-xs">Agent</span>
      <select
        aria-label="Filter by agent"
        value={agent}
        onChange={handleChange}
        className="border-border bg-background text-foreground flex-1 rounded-md border px-2 py-1 text-sm"
      >
        <option value="">All agents</option>
        {agentNames.map((name) => (
          <option
            key={name}
            value={name}
          >
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The search box above the conversation list. */
function ListSearch({
  search,
  onSearch,
}: {
  readonly search: string
  readonly onSearch: (value: string) => void
}): ReactElement {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onSearch(event.target.value),
    [onSearch]
  )
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground-subtle pointer-events-none absolute top-2.5 left-2.5"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={search}
        onChange={handleChange}
        placeholder="Search conversations…"
        aria-label="Search conversations"
        className="border-border bg-background-raised focus:border-border-strong focus:ring-focus-ring/30 w-full rounded-md border py-1.5 pr-3 pl-8 text-sm transition-colors focus:ring-2 focus:outline-none"
      />
    </div>
  )
}

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
      <span className="text-foreground truncate text-sm font-medium">{conversation.title}</span>
      {/* The agent name used to lead this line, from when the list merged every
          agent. Scoped to one agent by the URL, it repeated the breadcrumb, the
          sidebar's active row and the page heading on every row — four times for
          one fact. Dropped; `agentName` stays on the row because the transcript
          fetch is agent-scoped and still needs it. */}
      <span className="text-foreground-subtle flex items-center gap-2 text-xs">
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

/** A centered state card for the list column (loading / empty / no-match / error). */
function ListStateCard({
  label,
  title,
  body,
  children,
}: {
  readonly label: string
  readonly title: string
  readonly body: string
  readonly children?: ReactElement
}): ReactElement {
  return (
    <section
      aria-label={label}
      className="border-border bg-background-raised flex flex-col items-center gap-1.5 rounded-md border border-dashed p-6 text-center"
    >
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-foreground-muted text-xs leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The loading skeleton for the list column. */
function ListLoading(): ReactElement {
  return (
    <div
      aria-label="Loading conversations"
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="border-border bg-background-subtle h-14 animate-pulse rounded-md border"
        />
      ))}
    </div>
  )
}

/** The error state for the list column (retryable). */
function ListErrorState({ onRetry }: { readonly onRetry: () => void }): ReactElement {
  return (
    <ListStateCard
      label="Couldn’t load"
      title="Couldn’t load conversations"
      body="The list could not be loaded. Try again."
    >
      <button
        type="button"
        onClick={onRetry}
        className="text-foreground-muted hover:text-foreground-muted/80 mt-1 text-xs font-medium"
      >
        Retry
      </button>
    </ListStateCard>
  )
}

/**
 * The empty state when the selected agent has no conversation yet.
 *
 * The list is scoped to ONE agent by the URL segment, so the copy names that
 * agent rather than "one of your agents" — which read as a whole-console
 * statement and told an operator looking at a quiet agent that NOTHING had
 * happened anywhere. The `region` label is unchanged: it is the locked selector.
 */
function ListEmptyState(): ReactElement {
  return (
    <ListStateCard
      label="No conversations yet"
      title="No conversations yet"
      body="Conversations appear here once a user talks to this agent."
    />
  )
}

/** The no-match state when a search narrows every conversation away. */
function ListNoMatchState({
  query,
  onResetSearch,
}: {
  readonly query: string
  readonly onResetSearch: () => void
}): ReactElement {
  return (
    <ListStateCard
      label="No results"
      title="No conversation matches"
      // Name the term, as the users and files grids do
      // (`No user matches “{query}”`). Echoing what was searched is what tells
      // the operator the search ran and this is the answer — rather than
      // leaving them to wonder whether the box did anything.
      body={`No conversation matches “${query}”.`}
    >
      <button
        type="button"
        onClick={onResetSearch}
        className="text-foreground-muted hover:text-foreground-muted/80 mt-1 text-xs font-medium"
      >
        Reset
      </button>
    </ListStateCard>
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
