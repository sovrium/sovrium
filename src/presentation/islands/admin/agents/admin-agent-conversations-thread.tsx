/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import {
  formatDateTime,
  roleLabel,
  type ConversationHeader,
  type ThreadMessage,
  type ThreadState,
} from './admin-agent-conversations-data'

function formatToolPayload(message: ThreadMessage): string {
  if (message.toolCalls != undefined) {
    try {
      return JSON.stringify(message.toolCalls, undefined, 2)
    } catch {
      return String(message.toolCalls)
    }
  }
  return message.content
}

function MessageTurn({ message }: { readonly message: ThreadMessage }): ReactElement {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const align = isUser ? 'items-end' : 'items-start'
  const bubble = isUser
    ? 'bg-warmth-subtle text-warmth-fg'
    : isTool
      ? 'bg-background-subtle text-foreground-muted border-border border font-mono'
      : 'bg-background-raised text-foreground border-border border'

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className="text-foreground-subtle flex items-center gap-2 px-1 text-xs">
        <span className="font-medium">{roleLabel(message.role)}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatDateTime(message.createdAt)}</span>
      </div>
      <div className={`max-w-[44rem] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${bubble}`}>
        {isTool ? (
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">
            {formatToolPayload(message)}
          </pre>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      <MessageFootnote message={message} />
    </div>
  )
}

function MessageFootnote({
  message,
}: {
  readonly message: ThreadMessage
}): ReactElement | undefined {
  const parts: ReadonlyArray<string> = [
    message.model ? message.model : '',
    typeof message.tokenCount === 'number' ? `${message.tokenCount} jetons` : '',
  ].filter((part) => part.length > 0)
  const interrupted = message.status === 'incomplete'
  if (parts.length === 0 && !interrupted) return undefined
  return (
    <div className="text-foreground-subtle flex items-center gap-2 px-1 text-xs">
      {parts.length > 0 ? <span className="font-mono">{parts.join(' · ')}</span> : undefined}
      {interrupted ? (
        <span className="text-warmth-fg inline-flex items-center gap-1 font-medium">
          <span aria-hidden="true">•</span> réponse interrompue
        </span>
      ) : undefined}
    </div>
  )
}

function ThreadHeader({ header }: { readonly header: ConversationHeader }): ReactElement {
  return (
    <header className="border-border flex flex-col gap-1 border-b pb-3">
      <h3 className="text-foreground text-lg font-semibold tracking-tight">{header.title}</h3>
      <p className="text-foreground-subtle flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono">{header.sessionId}</span>
        <span aria-hidden="true">·</span>
        <span>Dernière activité {formatDateTime(header.lastActivityAt)}</span>
      </p>
    </header>
  )
}

function ThreadStateCard({
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
      className="border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center"
    >
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-foreground-muted max-w-sm text-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

function ThreadLoading(): ReactElement {
  return (
    <div
      aria-label="Chargement de la conversation"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className={[
            'bg-background-subtle border-border h-16 animate-pulse rounded-lg border',
            row % 2 === 0 ? 'mr-16' : 'ml-16',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

export function ConversationThread({
  state,
  onRetry,
}: {
  readonly state: ThreadState
  readonly onRetry: () => void
}): ReactElement {
  if (state.phase === 'idle') {
    return (
      <ThreadStateCard
        label="Choisir une conversation"
        title="Choisissez une conversation"
        body="Sélectionnez une conversation à gauche pour afficher son fil de messages."
      />
    )
  }
  if (state.phase === 'loading') return <ThreadLoading />
  if (state.phase === 'error') {
    return (
      <ThreadStateCard
        label="Erreur de chargement"
        title="Impossible de charger la conversation"
        body="Le fil de messages n’a pas pu être récupéré. Réessayez."
      >
        <button
          type="button"
          onClick={onRetry}
          className="text-warmth-fg hover:text-warmth-fg/80 mt-1 text-sm font-medium"
        >
          Réessayer
        </button>
      </ThreadStateCard>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {state.header ? <ThreadHeader header={state.header} /> : undefined}
      <div
        aria-label="Fil de messages"
        className="flex flex-col gap-4"
      >
        {state.messages.map((message) => (
          <MessageTurn
            key={message.id}
            message={message}
          />
        ))}
      </div>
    </div>
  )
}
