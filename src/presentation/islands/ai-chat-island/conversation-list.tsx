/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { branchOf, conversationUrl, type BranchContext } from './branch-requests'
import type { BranchLabels } from './types'
import type { ReactElement } from 'react'

/**
 * The conversation list of the `ai-chat` panel, in the chunk of its
 * conversation controls (`chat-branch-controls.tsx`): the Conversations
 * button, opening the reader's conversations with the agent
 * (`GET /api/ai/conversations`) and New conversation; choosing one shows its
 * current branch.
 */

const QUIET = computePartButtonClasses({ variant: 'ghost', size: 'sm' })

/** An entry of the conversation list, New conversation included: one row, one alignment. */
const ENTRY =
  'hover:bg-accent focus:bg-accent data-[active=true]:bg-accent data-[active=true]:text-accent-foreground truncate rounded-sm px-2 py-1.5 text-start text-sm outline-none'
/** A line saying where the list stands: being read, empty, or failed. */
const NOTE = 'text-muted-foreground px-2 py-1.5 text-sm'

/** The note of a list read and found empty. */
const EMPTY: readonly [] = []

/** One conversation of the list. */
interface ConversationEntry {
  readonly sessionId: string
  readonly title: string | null
}

/** The open list: being read, failed, or read (empty or not). Closed is `undefined`. */
type ListState = 'loading' | 'failed' | readonly ConversationEntry[]

/**
 * The list's state, and reading it. A read that lands after the list was
 * closed leaves it closed. Escape anywhere in the switcher closes it and hands
 * the focus back to the button.
 */
function useConversationList(agent: string | undefined) {
  const [list, setList] = useState<ListState | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const open = list !== undefined
  const settle = (next: ListState) => setList((now) => (now === 'loading' ? next : now))
  const read = (): void => {
    setList('loading')
    const query = agent === undefined ? '' : `?agent=${encodeURIComponent(agent)}`
    void fetch(`/api/ai/conversations${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as { readonly conversations?: readonly ConversationEntry[] }
      })
      .then((body) => settle(body.conversations ?? []))
      .catch(() => settle('failed'))
  }
  useEffect(() => {
    const root = rootRef.current
    if (!open || root === null) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setList(undefined)
      triggerRef.current?.focus()
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [open])
  return { list, setList, read, rootRef, triggerRef }
}

/**
 * The Conversations button and what it opens: the reader's conversations with
 * the agent, newest first, each a link that shows it, and New conversation.
 * While the list is read the button is busy and the list says so; a read that
 * failed says so and offers Retry, which an empty list never does.
 */
export function ConversationSwitcher({
  agent,
  onNew,
  ...context
}: BranchContext & {
  readonly agent?: string | undefined
  readonly onNew: () => void
}): ReactElement {
  const { list, setList, read, rootRef, triggerRef } = useConversationList(agent)
  const choose = (sessionId: string): void => {
    setList(undefined)
    context.showBranch(branchOf(fetch(conversationUrl(sessionId))), sessionId)
  }
  return (
    <div
      ref={rootRef}
      className="relative flex shrink-0 items-center justify-end gap-1 border-b px-2 py-1"
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="chat-conversations-trigger"
        aria-expanded={list !== undefined}
        aria-busy={list === 'loading' ? true : undefined}
        onClick={() => (list === undefined ? read() : setList(undefined))}
        className={QUIET}
      >
        {context.labels.conversations}
      </button>
      {list !== undefined && (
        <ConversationList
          list={list}
          labels={context.labels}
          current={context.sessionId}
          onChoose={choose}
          onRetry={read}
          onNew={() => {
            setList(undefined)
            onNew()
          }}
        />
      )}
    </div>
  )
}

/** Where the list stands, when it holds no entries to show: being read, failed, or empty. */
function ListNote({
  list,
  labels,
  onRetry,
}: {
  readonly list: 'loading' | 'failed' | readonly []
  readonly labels: BranchLabels
  readonly onRetry: () => void
}): ReactElement {
  if (list === 'loading')
    return (
      <p
        role="status"
        className={NOTE}
      >
        {labels.loading}
      </p>
    )
  if (list === 'failed')
    return (
      <div
        role="alert"
        className="flex items-center gap-1.5"
      >
        <span className={NOTE}>{labels.failed}</span>
        <button
          type="button"
          onClick={onRetry}
          className={`${QUIET} ms-auto`}
        >
          {labels.retry}
        </button>
      </div>
    )
  return <p className={NOTE}>{labels.empty}</p>
}

/** The open list: New conversation, then one link per conversation, newest first. */
function ConversationList({
  list,
  labels,
  current,
  onChoose,
  onRetry,
  onNew,
}: {
  readonly list: ListState
  readonly labels: BranchLabels
  readonly current: string
  readonly onChoose: (sessionId: string) => void
  readonly onRetry: () => void
  readonly onNew: () => void
}): ReactElement {
  return (
    <div className="bg-popover text-popover-foreground absolute inset-x-2 top-full z-20 mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border p-1 shadow-md">
      <button
        type="button"
        data-testid="chat-new-conversation"
        onClick={onNew}
        className={`${ENTRY} font-medium`}
      >
        {labels.newConversation}
      </button>
      {typeof list === 'string' || list.length === 0 ? (
        <ListNote
          list={typeof list === 'string' ? list : EMPTY}
          labels={labels}
          onRetry={onRetry}
        />
      ) : (
        <nav
          aria-label={labels.conversations}
          className="flex flex-col"
        >
          {list.map((entry) => (
            <a
              key={entry.sessionId}
              href={`#${entry.sessionId}`}
              data-testid="chat-conversation"
              aria-current={entry.sessionId === current ? 'page' : undefined}
              data-active={entry.sessionId === current ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault()
                onChoose(entry.sessionId)
              }}
              className={ENTRY}
            >
              {entry.title ?? labels.untitled}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
