/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { computeMessageFooterClasses } from '@/presentation/design/message-default-classes'
import { branchOf, conversationUrl, post, type BranchContext } from './branch-requests'
import type { ChatMessage } from './types'
import type { ReactElement, RefObject } from 'react'

/**
 * The conversation controls of the `ai-chat` panel, loaded on their first use
 * (the first saved turn, or a chat that lists its conversations), so a chat
 * nobody answers yet does not pay for them:
 *
 *  - `ConversationSwitcher` (`conversation-list.tsx`, re-exported here so it
 *    shares this chunk): the Conversations button and the list it opens;
 *  - {@link TurnFooter}: a saved turn's `message-footer` — Edit on a question,
 *    Regenerate on an answer, and the pager between the versions of a message.
 *    The actions are icon buttons named by their label: the turn's text stays
 *    the turn's, so a reader (or a test) reading the message reads its words.
 *
 * Every request answers a branch of the conversation, which the panel puts on
 * screen in place of the transcript (`showBranch`): the routes decide what is
 * current, the window draws it. The turn a branch puts in place of the one the
 * reader acted on is a new turn, so the focus is carried over to it
 * ({@link pendingFocus}) rather than left to fall to the page.
 */

const QUIET = computePartButtonClasses({ variant: 'ghost', size: 'sm' })
const ARROW = computePartButtonClasses({ variant: 'ghost', size: 'icon-xs' })
const PRIMARY = computePartButtonClasses({ variant: 'default', size: 'sm' })

/**
 * Lucide `pencil`, `refresh-cw`, `chevron-left` and `chevron-right`, inline:
 * the footer's actions are icons, named by their label.
 */
const PENCIL =
  'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4'
const REFRESH =
  'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5'
const CHEVRON_LEFT = 'm15 18-6-6 6-6'
const CHEVRON_RIGHT = 'm9 18 6-6-6-6'

const Glyph = ({ path }: { readonly path: string }): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
)

/** A footer control the focus can be handed to. */
type FooterControl = 'action' | 'previous' | 'next'

/**
 * The control a branch request was made from, and the saved message it was
 * pressed on. The turn the branch puts in its place is a sibling of that
 * message (a regenerated answer, the next page), so its footer takes the focus
 * once the branch is on screen. Held at module level because the turn that
 * reads it is not the turn that wrote it.
 */
let pendingFocus: { readonly from: string; readonly control: FooterControl } | undefined

/** The footer's focusable controls: the action (Edit or Regenerate) and the pager's two. */
interface FooterRefs {
  readonly action: RefObject<HTMLButtonElement | null>
  readonly previous: RefObject<HTMLButtonElement | null>
  readonly next: RefObject<HTMLButtonElement | null>
}

/**
 * Take the focus a branch request left for this turn, once the branch is on
 * screen. A pager button with nowhere further to go hands it to the other one.
 */
function useCarriedFocus(message: ChatMessage, busy: boolean, refs: FooterRefs): void {
  useEffect(() => {
    const want = pendingFocus
    if (busy || want === undefined) return
    if (!(message.siblings ?? [message.serverId]).includes(want.from)) return
    pendingFocus = undefined
    const other = want.control === 'previous' ? refs.next : refs.previous
    const target = refs[want.control].current
    ;(target?.disabled === true ? other.current : target)?.focus()
  }, [message, busy, refs])
}

/**
 * The footer's controls, and where the focus goes: to the control a branch
 * request left it for, and back to Edit once the editor closes.
 */
function useFooterFocus(message: ChatMessage, busy: boolean, editing: boolean): FooterRefs {
  const action = useRef<HTMLButtonElement>(null)
  const previous = useRef<HTMLButtonElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const [refs] = useState<FooterRefs>(() => ({ action, previous, next }))
  useCarriedFocus(message, busy, refs)
  const wasEditing = useRef(editing)
  useEffect(() => {
    if (wasEditing.current && !editing) action.current?.focus()
    wasEditing.current = editing
  }, [editing])
  return refs
}

/** "2 / 3", between the versions of a message, each page the branch through it. */
function Pager({
  message,
  context,
  refs,
}: {
  readonly message: ChatMessage
  readonly context: BranchContext
  readonly refs: FooterRefs
}): ReactElement | null {
  const { labels } = context
  const question = message.role === 'user'
  const previous = question ? labels.previousVersion : labels.previousAnswer
  const next = question ? labels.nextVersion : labels.nextAnswer
  const siblings = message.siblings ?? []
  const at = siblings.indexOf(message.serverId ?? '')
  if (siblings.length < 2 || at < 0) return null
  const page = (to: string | undefined, control: FooterControl) => () => {
    if (to === undefined || message.serverId === undefined) return
    pendingFocus = { from: message.serverId, control }
    context.showBranch(
      branchOf(fetch(`${conversationUrl(context.sessionId)}?branch=${encodeURIComponent(to)}`))
    )
  }
  return (
    <span
      data-testid="chat-branch"
      className="inline-flex items-center gap-0.5 tabular-nums"
    >
      <button
        ref={refs.previous}
        type="button"
        aria-label={previous}
        disabled={context.busy || at === 0}
        onClick={page(siblings[at - 1], 'previous')}
        className={ARROW}
      >
        <Glyph path={CHEVRON_LEFT} />
      </button>
      {`${String(at + 1)} / ${String(siblings.length)}`}
      <button
        ref={refs.next}
        type="button"
        aria-label={next}
        disabled={context.busy || at === siblings.length - 1}
        onClick={page(siblings[at + 1], 'next')}
        className={ARROW}
      >
        <Glyph path={CHEVRON_RIGHT} />
      </button>
    </span>
  )
}

/**
 * A question being edited: its new text, sent as a new branch from it. It
 * takes the focus when it opens; Escape cancels, like Cancel.
 */
function EditBox({
  message,
  context,
  onClose,
}: {
  readonly message: ChatMessage
  readonly context: BranchContext
  readonly onClose: () => void
}): ReactElement {
  const { labels } = context
  const [text, setText] = useState(message.content)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => boxRef.current?.focus(), [])
  const save = (): void => {
    const content = text.trim()
    if (content.length === 0 || message.serverId === undefined) return
    context.showBranch(
      branchOf(
        post(
          `${conversationUrl(context.sessionId)}/messages/${encodeURIComponent(message.serverId)}/edit`,
          { content }
        )
      )
    )
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <textarea
        ref={boxRef}
        aria-label={labels.editMessage}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="border-input w-full min-w-0 resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm outline-none"
      />
      <span className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className={QUIET}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          disabled={context.busy}
          onClick={save}
          className={PRIMARY}
        >
          {labels.saveAndSend}
        </button>
      </span>
    </div>
  )
}

/**
 * A saved turn's actions: Edit on a question, Regenerate on an answer, and the
 * pager. `editing` is the turn's own state, since the editor takes the place
 * of the question's bubble; closing it hands the focus back to Edit.
 */
export function TurnFooter({
  message,
  editing: [editing, setEditing],
  ...context
}: BranchContext & {
  readonly message: ChatMessage
  readonly editing: readonly [boolean, (editing: boolean) => void]
}): ReactElement {
  const { labels } = context
  const question = message.role === 'user'
  const refs = useFooterFocus(message, context.busy, editing)
  const regenerate = (): void => {
    if (message.serverId === undefined) return
    pendingFocus = { from: message.serverId, control: 'action' }
    context.showBranch(
      branchOf(
        post(
          `${conversationUrl(context.sessionId)}/messages/${encodeURIComponent(message.serverId)}/regenerate`
        )
      )
    )
  }
  return (
    <div
      data-slot="message-footer"
      className={`${computeMessageFooterClasses()} gap-1`}
    >
      {editing ? (
        <EditBox
          message={message}
          context={context}
          onClose={() => setEditing(false)}
        />
      ) : (
        <>
          <Pager
            message={message}
            context={context}
            refs={refs}
          />
          <button
            ref={refs.action}
            type="button"
            data-testid={question ? 'chat-edit' : 'chat-regenerate'}
            aria-label={question ? labels.edit : labels.regenerate}
            title={question ? labels.edit : labels.regenerate}
            disabled={context.busy}
            onClick={question ? () => setEditing(true) : regenerate}
            className={ARROW}
          >
            <Glyph path={question ? PENCIL : REFRESH} />
          </button>
        </>
      )}
    </div>
  )
}

export { ConversationSwitcher } from './conversation-list'
