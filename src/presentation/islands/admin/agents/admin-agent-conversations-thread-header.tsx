/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The head of an open thread: its title and the line naming who held it, when
 * it began and how long it is, with the agent and its model as badges at the
 * row's end — and, on a phone, the way back to the list above it.
 */

import { type ReactElement } from 'react'
import { readDayRelativeTime } from '@/domain/kernel/format/day-relative-time'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { resolvePageLocale } from '../../runtime/page-locale'
import { resolvePageTimezone } from '../../runtime/page-timezone'
import { conversationCaptions, messageCountText } from './admin-agent-conversations-captions'
import type { ConversationHeader, ThreadMessage } from './admin-agent-conversations-data'

/** Who the thread names: its person, the agent, and the model the agent answers with. */
export interface ThreadNames {
  readonly agentLabel: string
  readonly agentModel: string
}

/** shadcn's outline badge. */
const BADGE =
  'border-border text-foreground inline-flex h-5 items-center rounded-md border px-2 text-xs font-medium'

/** The model the thread's answers recorded — the latest that names one — else the agent's. */
const threadModel = (messages: ReadonlyArray<ThreadMessage>, agentModel: string): string =>
  messages.findLast((message) => message.model !== undefined)?.model ?? agentModel

/**
 * When the thread began, inside its sentence and on the operator's clock: a
 * relative day in lower case and without the date's preposition
 * (`started today 10:15`, « commencée aujourd’hui 10:15 »), an earlier day as
 * the run history writes it (« commencée le 30 déc. 2025, 10:15 »).
 */
const startedText = (createdAt: string): string => {
  const captions = conversationCaptions()
  const at = new Date(createdAt)
  if (!createdAt || Number.isNaN(at.getTime())) return captions.started.replace('{date}', '—')
  const reading = readDayRelativeTime(at, usableLocale(resolvePageLocale()), resolvePageTimezone())
  const caption = reading.relative ? captions.startedRelative : captions.started
  return caption.replace('{date}', () => reading.text)
}

/**
 * The thread header: its title and a subtitle naming the person who held it,
 * when it began and how many messages it holds; the agent and model as badges.
 */
export function ThreadHeader({
  header,
  messages,
  names,
}: {
  readonly header: ConversationHeader
  readonly messages: ReadonlyArray<ThreadMessage>
  readonly names: ThreadNames
}): ReactElement {
  const model = threadModel(messages, names.agentModel)
  const facts = [
    header.userName,
    startedText(header.createdAt),
    messageCountText(messages.length),
  ].filter((fact) => fact !== '')
  return (
    <header className="border-border flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b pb-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-foreground text-md font-semibold">{header.title}</h3>
        <p
          data-testid="conversation-subtitle"
          className="text-muted-foreground text-sm"
        >
          {facts.join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {names.agentLabel === '' ? undefined : (
          <span
            data-testid="thread-agent-badge"
            data-slot="badge"
            className={BADGE}
          >
            {names.agentLabel}
          </span>
        )}
        {model === '' ? undefined : (
          <span
            data-testid="thread-model-badge"
            data-slot="badge"
            className={`${BADGE} bg-muted border-transparent font-mono`}
          >
            {model}
          </span>
        )}
      </div>
    </header>
  )
}

/** In a viewer narrower than 42rem, where the thread replaces the list: the way back to it. */
export function BackToList({ onBack }: { readonly onBack: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-sm font-medium @2xl:hidden"
    >
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
      >
        <path d="m10 3.5-4.5 4.5 4.5 4.5" />
      </svg>
      {conversationCaptions().back}
    </button>
  )
}
