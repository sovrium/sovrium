/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'
import type { ReactElement } from 'react'

/**
 * What the conversation list shows instead of conversations: loading, a
 * failed read, an empty list and a search that matched nothing.
 */

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
      className="border-border bg-card flex flex-col items-center gap-1.5 rounded-md border border-dashed p-6 text-center"
    >
      <p className="text-foreground text-md font-medium">{title}</p>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The loading skeleton for the list column. */
export function ListLoading(): ReactElement {
  return (
    <div
      role="status"
      data-loading-status=""
      aria-label={useWord('loading', 'Loading conversations')}
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="border-border bg-muted h-14 animate-pulse rounded-md border"
        />
      ))}
    </div>
  )
}

/** The error state for the list column (retryable). */
export function ListErrorState({ onRetry }: { readonly onRetry: () => void }): ReactElement {
  return (
    <ListStateCard
      label={useWord('loadFailedLabel', 'Couldn’t load')}
      title={useWord('loadFailed', 'Couldn’t load conversations')}
      body={useWord('loadFailedBody', 'The list could not be loaded. Try again.')}
    >
      <button
        type="button"
        onClick={onRetry}
        className="text-muted-foreground hover:text-muted-foreground/80 mt-1 text-sm font-medium"
      >
        {useWord('retry', 'Retry')}
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
export function ListEmptyState(): ReactElement {
  const empty = useWord('empty', 'No conversations yet')
  return (
    <ListStateCard
      label={empty}
      title={empty}
      body={useWord('emptyBody', 'Conversations appear here once a user talks to this agent.')}
    />
  )
}

/** The no-match state when a search narrows every conversation away. */
export function ListNoMatchState({
  query,
  onResetSearch,
}: {
  readonly query: string
  readonly onResetSearch: () => void
}): ReactElement {
  return (
    <ListStateCard
      label={useWord('noMatchLabel', 'No results')}
      title={useWord('noMatch', 'No conversation matches')}
      // Name the term, as the users and files grids do
      // (`No user matches “{query}”`). Echoing what was searched is what tells
      // the operator the search ran and this is the answer — rather than
      // leaving them to wonder whether the box did anything.
      body={useWord('noMatchBody', 'No conversation matches “{query}”.').replace(
        '{query}',
        () => query
      )}
    >
      <button
        type="button"
        onClick={onResetSearch}
        className="text-muted-foreground hover:text-muted-foreground/80 mt-1 text-sm font-medium"
      >
        {useWord('reset', 'Reset')}
      </button>
    </ListStateCard>
  )
}
