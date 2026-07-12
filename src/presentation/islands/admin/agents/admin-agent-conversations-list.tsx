/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ChangeEvent, type ReactElement, useCallback } from 'react'
import {
  formatRelative,
  type ConversationRow,
  type ListState,
} from './admin-agent-conversations-data'
import type { NewConversationState } from './admin-agent-conversations-state'

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
        className="border-warmth/40 bg-warmth-subtle text-warmth-fg hover:bg-warmth-subtle/70 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <span
          aria-hidden="true"
          className="text-base leading-none"
        >
          +
        </span>
        Nouvelle conversation
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
            <option value="">Choisir un agent…</option>
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

function AgentFilter({
  agent,
  onAgent,
  agentNames,
  hidden,
}: {
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
  readonly hidden: boolean
}): ReactElement | null {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onAgent(event.target.value),
    [onAgent]
  )
  if (agentNames.length < 2 || hidden) return null
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-foreground-subtle text-xs">Agent</span>
      <select
        aria-label="Filtrer par agent"
        value={agent}
        onChange={handleChange}
        className="border-border bg-background text-foreground flex-1 rounded-md border px-2 py-1 text-sm"
      >
        <option value="">Tous les agents</option>
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
        placeholder="Rechercher une conversation…"
        aria-label="Rechercher une conversation"
        className="border-border bg-background-raised focus:border-warmth focus:ring-warmth/30 w-full rounded-md border py-1.5 pr-3 pl-8 text-sm transition-colors focus:ring-2 focus:outline-none"
      />
    </div>
  )
}

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
          ? 'border-warmth/40 bg-warmth-subtle text-warmth-fg'
          : 'text-foreground-muted hover:border-border hover:bg-background-subtle border-transparent',
      ].join(' ')}
    >
      <span className="text-foreground truncate text-sm font-medium">{conversation.title}</span>
      <span className="text-foreground-subtle flex items-center gap-2 text-xs">
        {conversation.agentName && (
          <>
            <span className="text-foreground-muted truncate font-medium">
              {conversation.agentName}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{formatRelative(conversation.lastActivityAt)}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {conversation.messageCount} message{conversation.messageCount > 1 ? 's' : ''}
        </span>
      </span>
    </button>
  )
}

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

function ListLoading(): ReactElement {
  return (
    <div
      aria-label="Chargement des conversations"
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

function ListErrorState({ onRetry }: { readonly onRetry: () => void }): ReactElement {
  return (
    <ListStateCard
      label="Erreur de chargement"
      title="Impossible de charger les conversations"
      body="La liste n’a pas pu être récupérée. Réessayez."
    >
      <button
        type="button"
        onClick={onRetry}
        className="text-warmth-fg hover:text-warmth-fg/80 mt-1 text-xs font-medium"
      >
        Réessayer
      </button>
    </ListStateCard>
  )
}

function ListEmptyState(): ReactElement {
  return (
    <ListStateCard
      label="Aucune conversation"
      title="Aucune conversation"
      body="Vos agents n’ont pas encore de conversation. Elles s’afficheront ici dès qu’un utilisateur leur parlera."
    />
  )
}

function ListNoMatchState({ onResetSearch }: { readonly onResetSearch: () => void }): ReactElement {
  return (
    <ListStateCard
      label="Aucun résultat"
      title="Aucune conversation ne correspond"
      body="Aucune conversation ne correspond à votre recherche."
    >
      <button
        type="button"
        onClick={onResetSearch}
        className="text-warmth-fg hover:text-warmth-fg/80 mt-1 text-xs font-medium"
      >
        Réinitialiser
      </button>
    </ListStateCard>
  )
}

interface ConversationListProps {
  readonly state: ListState
  readonly visibleConversations: ReadonlyArray<ConversationRow>
  readonly selectedId: string | undefined
  readonly search: string
  readonly onSearch: (value: string) => void
  readonly onSelect: (id: string) => void
  readonly onRetry: () => void
  readonly onResetSearch: () => void
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
  readonly newConversation: NewConversationState
  readonly onStartNewConversation: () => void
  readonly onPickNewAgent: (value: string) => void
}

function ListBody(props: ConversationListProps): ReactElement {
  const { state, visibleConversations, selectedId, onSelect, onRetry, onResetSearch } = props
  if (state.phase === 'loading') return <ListLoading />
  if (state.phase === 'error') return <ListErrorState onRetry={onRetry} />
  if (state.conversations.length === 0) return <ListEmptyState />
  if (visibleConversations.length === 0) return <ListNoMatchState onResetSearch={onResetSearch} />
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
