/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { INTERPRETER_UI_STRINGS } from '@/domain/models/app/languages/interpreter-ui-strings'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Per-locale copy for the `ai-chat` panel's engine-written words.
 *
 * The sentence a failed turn shows, its Retry button, and the notice a host with
 * no AI provider draws are platform chrome, like the closed-form page
 * (`render/forms/form-closed-labels.ts`): they follow the document's language
 * through the interpreter catalogue (`aiChat.*`), where an author renames any of
 * them under `sovrium.aiChat.<key>`. The engine ships English and French; any
 * other language falls back to English rather than rendering blank.
 */
export interface AiChatLabels {
  readonly failure: string
  readonly retry: string
  readonly notConfigured: string
  /** The separator closing replayed history, so new turns read as new. */
  readonly history: string
  /** On every attached file's chip: the agent receives the message text only. */
  readonly notSent: string
  /** The control that stops a streaming reply, and the marker a stopped one keeps. */
  readonly stop: string
  readonly stopped: string
  /** The collapsed marker holding the model's reasoning. */
  readonly reasoning: string
  /** The decisions on a call the agent holds, and the line saying it waits for one. */
  readonly approve: string
  readonly deny: string
  readonly awaitingApproval: string
  /** After a tool's name: the call was denied, failed, is running, or no longer waits. */
  readonly denied: string
  readonly failed: string
  readonly running: string
  readonly closed: string
  /** The words of a question the agent asks the reader, drawn as a questionnaire. */
  readonly question: AiChatQuestionLabels
  /** The group of sources an answer cites, under its bubble. */
  readonly sources: string
  /** The conversation list, and the actions in each turn's footer. */
  readonly branch: AiChatBranchLabels
  /** The composer's controls and the dictation button. */
  readonly composer: AiChatComposerLabels
  /** The transcript's accessible name, and the live marker while a reply is awaited. */
  readonly log: string
  readonly responding: string
  /** The name of the strip of suggested questions under the composer. */
  readonly suggestions: string
  /** The message box's placeholder when the author sets none. */
  readonly placeholder: string
}

/** The composer: its controls, its field's name, and push-to-talk. */
export interface AiChatComposerLabels {
  readonly send: string
  readonly attach: string
  /** The attach control's accessible name. */
  readonly attachFile: string
  readonly attachedFiles: string
  /** The message box's accessible name. */
  readonly message: string
  readonly talk: string
  readonly listening: string
  /** A recording the speech service could not read. */
  readonly voiceError: string
}

/** The conversation list and a turn's Edit, Regenerate and pager. */
export interface AiChatBranchLabels {
  readonly conversations: string
  readonly newConversation: string
  readonly edit: string
  /** The name of the text box an edited question is typed in. */
  readonly editMessage: string
  readonly saveAndSend: string
  readonly cancel: string
  readonly regenerate: string
  /** The pager between the answers to one question. */
  readonly previousAnswer: string
  readonly nextAnswer: string
  /** The pager between the versions of an edited question. */
  readonly previousVersion: string
  readonly nextVersion: string
  /** The open list while it is read, when it is empty, when it failed, and its Retry. */
  readonly loading: string
  readonly empty: string
  readonly failed: string
  readonly retry: string
  /** A conversation whose session never got a title. */
  readonly untitled: string
}

/** The questionnaire's words when the agent asks, and the line an answered question leaves. */
export interface AiChatQuestionLabels {
  readonly send: string
  readonly decline: string
  readonly next: string
  readonly previous: string
  readonly skip: string
  readonly yes: string
  readonly no: string
  /** Before the answer's values. */
  readonly answered: string
  readonly declined: string
  /** Before the name of the external MCP server asking, above its question. */
  readonly askedBy: string
  /** A question the server no longer holds, answered or dismissed elsewhere. */
  readonly closed: string
}

/** The catalogue keys of the panel's words: `aiChat.<path>`, one dot per group. */
const AI_CHAT_KEY_PREFIX = 'aiChat.'

/** Set `value` at the dotted `path` of `target`, creating each group on the way. */
const nest = (
  target: Record<string, unknown>,
  path: string,
  value: string
): Record<string, unknown> => {
  const [head = path, ...rest] = path.split('.')
  if (rest.length === 0) return { ...target, [head]: value }
  const group = (target[head] ?? {}) as Record<string, unknown>
  return { ...target, [head]: nest(group, rest.join('.'), value) }
}

/**
 * Resolve the panel's words for the document language from the interpreter
 * catalogue (`aiChat.*`), an author's `sovrium.aiChat.<key>` first. A regional
 * tag resolves through its primary subtag (`fr-FR` → `fr`); `undefined` and a
 * language the engine does not ship read English, or the author's fallback.
 */
export const getAiChatLabels = (lang: string | undefined, languages?: Languages): AiChatLabels => {
  const labels = Object.keys(INTERPRETER_UI_STRINGS)
    .filter((key) => key.startsWith(AI_CHAT_KEY_PREFIX))
    .reduce<Record<string, unknown>>(
      (built, key) =>
        nest(
          built,
          key.slice(AI_CHAT_KEY_PREFIX.length),
          resolveInterpreterString(key, lang, languages)
        ),
      {}
    )
  // eslint-disable-next-line sovrium/no-double-assertion -- the `aiChat.*` keys ARE the interface's paths, one leaf each; ai-chat-labels.test.ts holds the two in step
  return labels as unknown as AiChatLabels
}
