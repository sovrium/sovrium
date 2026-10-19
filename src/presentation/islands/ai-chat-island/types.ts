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
  /**
   * Chat container height in pixels — forwarded for completeness, and
   * deliberately NOT read by this island.
   *
   * The SSR host already carries it as an inline `height`, and the island
   * renders INTO that host, so it inherits the bound rather than re-applying
   * it. Sizing anything here from this number is how `[internal ref]`
   * happened: the message log floored itself at the container's full height and
   * pushed the composer past the clip. If you need it, you almost certainly
   * need `h-full` instead.
   */
  readonly chatHeight?: number
  /** When true, prior conversation turns are replayed on mount. */
  readonly showHistory?: boolean
  /** When true, the header lists the reader's conversations with the agent. */
  readonly conversations?: boolean
  /** When true, a file-attachment button is shown in the input row. */
  readonly allowAttachments?: boolean
  /**
   * Present when the chat declares an `attachments` block: picked files are
   * uploaded at once to `POST /api/ai/chat/attachments?chat=<chatId>` and sent
   * with the turn as `file` / `image` parts.
   */
  readonly uploads?: { readonly chatId: string }
  /** Table scope narrowing forwarded to the chat backend as `pageContext`. */
  readonly allowedTables?: ReadonlyArray<string>
  /**
   * Starter prompts drawn as chips under the composer. Already resolved — any
   * `$t:` entry was substituted server-side before `data-island-props` was
   * serialised. Absent entirely when the author declared none, never `[]`: the
   * renderer settles "is there anything to draw" once, rather than leaving it
   * to be re-decided on every render here.
   */
  readonly suggestions?: ReadonlyArray<string>
  /**
   * Push-to-talk dictation, when the author declared `voiceInput` on the
   * component. Absent means no microphone button.
   */
  readonly voiceInput?: ChatVoiceInput
  /** When true, each answer ends with the number of tokens its turn used. */
  readonly showUsage?: boolean
  /**
   * The engine-written words of the panel, already resolved to the page's
   * language server-side. The renderer always sends them, so the island ships
   * no second copy in English.
   */
  readonly labels: ChatLabels
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

/** Every engine-written word of the panel, in the page language. */
export interface ChatLabels {
  /** A failed turn's line and its Retry. */
  readonly failure: string
  readonly retry: string
  /** The separator closing replayed history. */
  readonly history: string
  /** The line on an attached file's chip saying it does not reach the agent. */
  readonly notSent: string
  /** The control that stops a reply while it streams, and the marker it leaves. */
  readonly stop: string
  readonly stopped: string
  /** The collapsed line holding the model's reasoning. */
  readonly reasoning: string
  /** The titles of a tool card's two blocks: what the call was given, and what it returned. */
  readonly input: string
  readonly output: string
  /** The footer of a tool card's block whose preview was cut. */
  readonly truncated: string
  /** The decisions on a held call, and the words after a tool's name, by its state. */
  readonly approve: string
  readonly deny: string
  readonly awaitingApproval: string
  readonly denied: string
  readonly failed: string
  readonly running: string
  readonly closed: string
  /** The words of a question the agent asks, drawn as a questionnaire. */
  readonly question: QuestionLabels
  /** The group of sources an answer cites. */
  readonly sources: string
  /** The conversation list and a turn's Edit, Regenerate and pager. */
  readonly branch: BranchLabels
  readonly composer: ComposerLabels
  /** The transcript's name, and the live marker while a reply is awaited. */
  readonly log: string
  readonly responding: string
  /** The name of the strip of suggested questions. */
  readonly suggestions: string
  /** The token count under an answer, and its split; `{count}` is the formatted number. */
  readonly usageTotal: string
  readonly usageInput: string
  readonly usageOutput: string
}

/** The composer's words, and push-to-talk's. */
export interface ComposerLabels {
  readonly send: string
  readonly attach: string
  readonly attachFile: string
  readonly attachedFiles: string
  readonly message: string
  readonly talk: string
  readonly listening: string
  readonly voiceError: string
  readonly holdToTalk: string
  readonly micUnsupported: string
  readonly micRefused: string
}

/** A single chat message displayed in the message log. */
export interface ChatMessage {
  /** Stable identity used to update / remove a specific message. */
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  /** Files the reader attached to this turn, drawn as `attachment` chips. */
  readonly attachments?: readonly ChatAttachment[]
  /**
   * An answer's Markdown as the server rendered and sanitized it, and how much
   * of `content` it covers: the text that arrived after the last rendering is
   * drawn as plain text after it until the next one lands.
   */
  readonly html?: string
  readonly htmlCovers?: number
  /** The model's reasoning, drawn apart from the answer. */
  readonly reasoning?: string
  /** The tools the agent called while answering, in order. */
  readonly tools?: readonly ChatToolLine[]
  /** True while the answer is still arriving. */
  readonly streaming?: boolean
  /** Why the answer ended, when it did not simply end: `stopped`, `awaiting_input`, … */
  readonly stopReason?: string
  /** A question the agent asked in this turn (`elicit`), and where its answer stands. */
  readonly elicitation?: ChatElicitation
  /** The id the turn is saved under, once known: what Edit, Regenerate and the next turn name. */
  readonly serverId?: string
  /** The ids of every message written in this one's place, itself included, oldest first. */
  readonly siblings?: readonly string[]
  /** The knowledge passages the answer cites, drawn under its bubble. */
  readonly citations?: readonly ChatCitation[]
  /** The tokens the turn used, as the provider reported them; live turns only. */
  readonly usage?: ChatUsage
}

/** The tokens one turn used, summed over its model calls. */
export interface ChatUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
}

/** One knowledge passage an answer cites, by the number the answer marks it with. */
export interface ChatCitation {
  readonly index: number
  readonly label: string
  readonly excerpt: string
}

/** The conversation list and a turn's actions, in the page language. */
export interface BranchLabels {
  readonly conversations: string
  readonly newConversation: string
  readonly edit: string
  readonly editMessage: string
  readonly saveAndSend: string
  readonly cancel: string
  readonly regenerate: string
  readonly previousAnswer: string
  readonly nextAnswer: string
  readonly previousVersion: string
  readonly nextVersion: string
  /** The open list while read, empty, or failed, its Retry, and an untitled entry. */
  readonly loading: string
  readonly empty: string
  readonly failed: string
  readonly retry: string
  readonly untitled: string
}

/** One field of a question the agent asks: flat, as `ask_user` allows. */
export interface ChatElicitationField {
  readonly type: 'string' | 'number' | 'integer' | 'boolean'
  readonly title: string
  readonly description?: string
  readonly enum?: readonly string[]
  readonly format?: string
}

/**
 * A question the agent asked, drawn as a questionnaire in agent mode until it
 * is answered, then as the line saying how. `error` is the server's refusal of
 * an answer, on the field it names.
 */
export interface ChatElicitation {
  readonly id: string
  readonly message: string
  /** The external MCP server asking, by its declared name; absent for the agent's own question. */
  readonly server?: string
  readonly requestedSchema: {
    readonly properties: Readonly<Record<string, ChatElicitationField>>
    readonly required?: readonly string[]
  }
  /** `closed`: the server no longer holds it — it was answered or dismissed elsewhere. */
  readonly state: 'open' | 'sending' | 'answered' | 'declined' | 'cancelled' | 'closed'
  /** The answer's values, in the question's order, once answered. */
  readonly summary?: readonly string[]
  readonly error?: { readonly field: string; readonly message: string }
}

/** How the person answers a question: the form's values, or by declining or dismissing it. */
export type ChatElicitationAnswer =
  | {
      readonly action: 'accept'
      readonly content: Readonly<Record<string, string | number | boolean>>
    }
  | { readonly action: 'decline' | 'cancel' }

/** The words of a question the agent asks, in the page language. */
export interface QuestionLabels {
  readonly send: string
  readonly decline: string
  readonly next: string
  readonly previous: string
  readonly skip: string
  readonly yes: string
  readonly no: string
  /** Before the answer's values, on the line an answered question leaves. */
  readonly answered: string
  readonly declined: string
  /** Before the name of the MCP server asking, above its question. */
  readonly askedBy: string
  /** The line a question the server no longer holds gives way to. */
  readonly closed: string
}

/**
 * Where a tool the agent called stands. `closed`: it was held for a decision
 * the server no longer waits for — decided elsewhere, or expired.
 */
export type ChatToolState = 'running' | 'done' | 'failed' | 'denied' | 'pending-approval' | 'closed'

/** One tool call, drawn as a line in the answer. */
export interface ChatToolLine {
  readonly id: string
  readonly name: string
  readonly state: ChatToolState
  /** Set while the call waits for the reader to approve or deny it. */
  readonly approvalId?: string
  /** What the call was given, as the reader may read it, and whether the preview was cut. */
  readonly input?: string
  readonly inputTruncated?: boolean
  /** What the call returned, as the reader may read it, and whether the preview was cut. */
  readonly output?: string
  readonly outputTruncated?: boolean
}

/**
 * A file picked in the composer, drawn as an `attachment` chip in its state.
 *
 * Without an `attachments` block the chip stays `idle`: the file is shown with
 * the turn and never leaves the browser. With one, the file is uploaded as soon
 * as it is picked (`uploading`), then `done` with the id the server gave it, or
 * `error` with the reason it was refused; only a `done` file is sent.
 */
export interface ChatAttachment {
  readonly name: string
  readonly size: number
  /** Identity in the composer, while the upload is in flight. */
  readonly localId?: string
  readonly state?: 'idle' | 'uploading' | 'done' | 'error'
  /** The stored file's id, once `done`. */
  readonly attachmentId?: string
  /** The type the server read from the content, once `done`. */
  readonly mimeType?: string
  /** Why the upload was refused, once `error`. */
  readonly error?: string
}

/**
 * Possible runtime states of the chat surface: `sending` until the server
 * answers, `streaming` while the answer arrives (Stop replaces Send).
 */
export type ChatStatus = 'idle' | 'sending' | 'streaming' | 'error'

/** A persisted conversation turn returned by `GET /api/ai/conversations/:id`. */
export interface ConversationMessageDto {
  readonly id?: string
  readonly role: string
  readonly content: string
  readonly html?: string
  readonly siblings?: readonly string[]
  readonly elicitation?: { readonly message: string; readonly server?: string }
}

/** The `voiceInput` settings forwarded by the renderer. */
export interface ChatVoiceInput {
  /** `draft` (default) fills the message box; `send` sends the transcript. */
  readonly mode?: 'draft' | 'send'
  /** Two-letter ISO 639-1 hint for the speech engine. */
  readonly language?: string
  /** Speech tier; `fast` when omitted. */
  readonly quality?: 'fast' | 'accurate'
  /** Longest recording, in seconds; 300 when omitted. */
  readonly maxDurationSeconds?: number
}
