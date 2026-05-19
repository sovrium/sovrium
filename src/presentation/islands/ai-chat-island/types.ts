/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface AiChatIslandProps {
  readonly agent?: string
  readonly placeholder?: string
  readonly chatHeight?: number
  readonly showHistory?: boolean
  readonly allowAttachments?: boolean
  readonly allowedTables?: ReadonlyArray<string>
  readonly 'data-testid'?: string
  readonly initialValues?: Readonly<Record<string, string>>
}

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export type ChatStatus = 'idle' | 'sending' | 'error'

export interface ConversationMessageDto {
  readonly role: string
  readonly content: string
}
