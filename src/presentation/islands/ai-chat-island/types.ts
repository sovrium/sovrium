/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared types for the interactive `ai-chat` island.
 *
 * The island is mounted from the SSR placeholder emitted by
 * `ai-chat-component.tsx`; its props are the JSON-serialised `data-island-props`
 * carried by that placeholder.
 */

/** Author-declared props forwarded from the page-component schema. */
export interface AiChatIslandProps {
  /** Declared `app.agents[]` entry name the chat is bound to, if any. */
  readonly agent?: string
  /** Custom placeholder text for the message input. */
  readonly placeholder?: string
  /** Chat container height in pixels. */
  readonly chatHeight?: number
  /** When true, prior conversation turns are replayed on mount. */
  readonly showHistory?: boolean
  /** When true, a file-attachment button is shown in the input row. */
  readonly allowAttachments?: boolean
  /** Table scope narrowing forwarded to the chat backend as `pageContext`. */
  readonly allowedTables?: ReadonlyArray<string>
  /** Optional test id propagated from the component schema. */
  readonly 'data-testid'?: string
  /**
   * Form values captured from the SSR skeleton before hydration, keyed by
   * input `name`. The island client injects this when the user typed into the
   * static input before the island mounted — used to seed the draft so input
   * is not lost across the hydration boundary.
   */
  readonly initialValues?: Readonly<Record<string, string>>
}

/** A single chat message displayed in the message log. */
export interface ChatMessage {
  /** Stable identity used to update / remove a specific message. */
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** Possible runtime states of the chat surface. */
export type ChatStatus = 'idle' | 'sending' | 'error'

/** A persisted conversation turn returned by `GET /api/ai/conversations/:id`. */
export interface ConversationMessageDto {
  readonly role: string
  readonly content: string
}
