/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderer for the `ai-chat` page component.
 *
 * Emits the `data-island="ai-chat"` placeholder consumed by the island client
 * (`island-client.tsx`), which discovers the marker, parses `data-island-props`,
 * and mounts the interactive {@link "../../../../islands/ai-chat-island"} into
 * it. The placeholder body is an accessible, static chat skeleton (a
 * `role="log"` message area plus a labelled message-input row) preserved by the
 * island client as the Suspense fallback while the island bundle loads.
 *
 * The placeholder `<div>` itself carries the canonical `data-component="ai-chat"`
 * marker and the author-declared `data-*` attributes:
 *  - `data-agent`: the declared `app.agents[]` entry to chat with
 *.
 *  - `data-allowed-tables`: a JSON array narrowing the chat's table scope.
 * Because the island client mounts INTO this `<div>` (it does not replace it),
 * those attributes — and the `data-component` marker — survive hydration, so
 * spec attribute/visibility assertions resolve before AND after the island
 * mounts.
 *
 * Degraded mode: when no AI provider is resolvable — `AI_PROVIDER` empty
 * (configured-but-disabled) OR unset entirely (an inert agent, [internal ref]) — the
 * skeleton renders a "not configured / unavailable" notice instead of the input
 * row, and the island is not requested; there is no working backend to chat with
 *.
 */

import { isAiProviderConfigured } from '@/domain/models/env/ai/ai-providers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

/** Stable height fallback for the chat container when `chatHeight` is unset. */
const DEFAULT_CHAT_HEIGHT_PX = 400

/**
 * AI chat is "disabled" whenever no AI provider is resolvable — the
 * configured-but-empty `AI_PROVIDER` case AND the entirely-unset case ([internal ref]:
 * an `ai-chat` panel bound to an inert agent). In both states there is no
 * working chat backend, so the panel shows the degraded notice with no live
 * send control rather than a chat box that silently fails on send.
 */
const isAiDisabled = (): boolean => !isAiProviderConfigured(process.env)

/** Author-declared `ai-chat` props resolved from the component schema. */
interface AiChatProps {
  readonly agent: string | undefined
  readonly placeholder: string
  readonly chatHeight: number
  readonly allowAttachments: boolean
  readonly allowedTables: ReadonlyArray<string> | undefined
  readonly testId: string
  /** JSON `data-island-props` payload for the client island. */
  readonly islandPropsJson: string
}

/** Read the author-declared `ai-chat` props off the raw component props. */
const resolveAiChatProps = (
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>
): AiChatProps => {
  const props = rawProps ?? {}
  const agent = props.agent as string | undefined
  const placeholder = (props.placeholder as string | undefined) ?? 'Ask a question…'
  const chatHeight = (props.chatHeight as number | undefined) ?? DEFAULT_CHAT_HEIGHT_PX
  const showHistory = props.showHistory as boolean | undefined
  const allowAttachments = props.allowAttachments === true
  const allowedTables = props.allowedTables as ReadonlyArray<string> | undefined
  const testId = (elementProps['data-testid'] as string | undefined) ?? 'ai-chat'
  return {
    agent,
    placeholder,
    chatHeight,
    allowAttachments,
    allowedTables,
    testId,
    islandPropsJson: JSON.stringify({
      ...(agent !== undefined && { agent }),
      placeholder,
      chatHeight,
      ...(showHistory !== undefined && { showHistory }),
      ...(props.allowAttachments !== undefined && { allowAttachments }),
      ...(allowedTables !== undefined && { allowedTables }),
      'data-testid': testId,
    }),
  }
}

/** Degraded-mode body shown when AI is configured-but-disabled. */
const renderDisabledBody = (): ReactElement => (
  <div
    role="status"
    className="text-foreground-muted flex flex-1 items-center justify-center p-6 text-sm"
  >
    AI chat is not configured and is currently unavailable.
  </div>
)

/** Static chat skeleton — the island client upgrades this on hydration. */
const renderSkeletonBody = ({ placeholder, allowAttachments }: AiChatProps): ReactElement => (
  <>
    {/* Scrollable message log — empty until the island replays history */}
    <div
      data-ai-chat-messages
      data-testid="chat-messages"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className="chat-messages text-foreground-muted flex-1 overflow-y-auto p-4 text-sm"
    />

    {/* Message input row — the island upgrades this to a live form */}
    <form
      data-ai-chat-form
      className="border-border flex items-center gap-2 border-t p-3"
    >
      <label
        htmlFor="ai-chat-input"
        className="sr-only"
      >
        Message
      </label>
      {allowAttachments && (
        <button
          type="button"
          data-testid="chat-attach"
          aria-label="Attach file"
          className="border-border text-foreground-muted rounded border px-2 py-2 text-sm"
        >
          Attach
        </button>
      )}
      <input
        id="ai-chat-input"
        data-ai-chat-input
        data-testid="chat-input"
        type="text"
        name="message"
        placeholder={placeholder}
        className="border-border flex-1 rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        data-ai-chat-send
        data-testid="chat-send"
        disabled
        className="bg-primary text-primary-fg rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  </>
)

export const aiChatComponent: ComponentRenderer = ({ elementProps, rawProps }) => {
  const resolved = resolveAiChatProps(rawProps, elementProps)
  const { agent, chatHeight, allowedTables, testId, islandPropsJson } = resolved
  const disabled = isAiDisabled()

  return (
    <div
      data-island={disabled ? undefined : 'ai-chat'}
      data-island-props={disabled ? undefined : islandPropsJson}
      data-component="ai-chat"
      data-component-type="ai-chat"
      data-testid={testId}
      data-agent={agent}
      data-allowed-tables={allowedTables !== undefined ? JSON.stringify(allowedTables) : undefined}
      className="ai-chat-container border-border bg-background-raised flex flex-col rounded-lg border"
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call height merge in a stateless SSR renderer; memoization happens in the outer ComponentRenderer
      style={{ height: `${chatHeight}px` }}
    >
      {disabled ? renderDisabledBody() : renderSkeletonBody(resolved)}
    </div>
  )
}
