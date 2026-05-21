/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const DEFAULT_CHAT_HEIGHT_PX = 400

const isAiDisabled = (): boolean => process.env.AI_PROVIDER === ''

interface AiChatProps {
  readonly agent: string | undefined
  readonly placeholder: string
  readonly chatHeight: number
  readonly allowAttachments: boolean
  readonly allowedTables: ReadonlyArray<string> | undefined
  readonly testId: string
  readonly islandPropsJson: string
}

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

const renderDisabledBody = (): ReactElement => (
  <div
    role="status"
    className="flex flex-1 items-center justify-center p-6 text-sm text-fg-muted"
  >
    AI chat is not configured and is currently unavailable.
  </div>
)

const renderSkeletonBody = ({ placeholder, allowAttachments }: AiChatProps): ReactElement => (
  <>
    {}
    <div
      data-ai-chat-messages
      data-testid="chat-messages"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className="chat-messages flex-1 overflow-y-auto p-4 text-sm text-fg-muted"
    />

    {}
    <form
      data-ai-chat-form
      className="flex items-center gap-2 border-t border-border p-3"
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
          className="rounded border border-border px-2 py-2 text-sm text-fg-muted"
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
        className="flex-1 rounded border border-border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        data-ai-chat-send
        data-testid="chat-send"
        disabled
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:cursor-not-allowed disabled:opacity-50"
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
      className="ai-chat-container flex flex-col rounded-lg border border-border bg-bg-raised"
      style={{ height: `${chatHeight}px` }}
    >
      {disabled ? renderDisabledBody() : renderSkeletonBody(resolved)}
    </div>
  )
}
