/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
      className="border-border bg-background-raised flex flex-col items-center gap-1.5 rounded-md border border-dashed p-6 text-center"
    >
      <p className="text-foreground text-md font-medium">{title}</p>
      <p className="text-foreground-muted text-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The loading skeleton for the list column. */
export function ListLoading(): ReactElement {
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
export function ListErrorState({ onRetry }: { readonly onRetry: () => void }): ReactElement {
  return (
    <ListStateCard
      label="Couldn’t load"
      title="Couldn’t load conversations"
      body="The list could not be loaded. Try again."
    >
      <button
        type="button"
        onClick={onRetry}
        className="text-foreground-muted hover:text-foreground-muted/80 mt-1 text-sm font-medium"
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
export function ListEmptyState(): ReactElement {
  return (
    <ListStateCard
      label="No conversations yet"
      title="No conversations yet"
      body="Conversations appear here once a user talks to this agent."
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
        className="text-foreground-muted hover:text-foreground-muted/80 mt-1 text-sm font-medium"
      >
        Reset
      </button>
    </ListStateCard>
  )
}
