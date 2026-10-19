/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The static skeleton of an `ai-chat` panel: the transcript frame
 * (`message-scroller`), the `input-group` composer and the suggestion chips,
 * drawn server-side from the same recipes the island uses so nothing repaints
 * when it mounts. The island client upgrades it on hydration; a specimen keeps
 * it inert.
 */

import {
  AI_CHAT_TRANSCRIPT_FIT,
  computeAiChatComposerButtonClasses,
  computeAiChatComposerClasses,
  computeAiChatErrorClasses,
  computeAiChatSuggestionChipClasses,
  computeAiChatSuggestionStripClasses,
  computeAiChatTextareaClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
} from '@/presentation/design/input-group-default-classes'
import { computeMessageScrollerClasses } from '@/presentation/design/message-scroller-default-classes'
import type { AiChatComposerLabels, AiChatLabels } from './ai-chat-labels'
import type { ReactElement } from 'react'

/**
 * The three statuses an `ai-chat` specimen may be DEPICTED in — the same
 * three the island passes through: at rest, a reply arriving, a failed turn.
 */
export type AiChatSpecimenStatus = 'idle' | 'streaming' | 'error'

/** What the skeleton draws from the resolved options. */
export interface AiChatSkeletonInput {
  readonly placeholder: string
  readonly allowAttachments: boolean
  readonly suggestions: ReadonlyArray<string> | undefined
  readonly voiceInput: object | undefined
  /**
   * The URL parameter whose words the composer opens with. Marked on the
   * skeleton's box as `data-draft-param` and read in the browser just before the
   * island mounts (`pre-mount-input.ts`), so the server renders one page for
   * every address and never reads the words itself.
   */
  readonly draftParam?: string | undefined
  readonly labels: AiChatLabels
}

/**
 * The skeleton's controls, drawn from the SAME recipes the island uses
 * (`presentation/design` is the one directory both sides may import), so the
 * panel does not repaint the instant the island mounts.
 */
const SEND_BUTTON = `${computeAiChatComposerButtonClasses('default')} ms-auto`
const ATTACH_BUTTON = computeAiChatComposerButtonClasses('ghost')

/** A prompt chip, wrapping a long prompt inside the panel rather than running past it. */
const SUGGESTION_CHIP = computeAiChatSuggestionChipClasses()

/**
 * The failed-turn banner, drawn from the island's own recipe.
 *
 * Only a specimen reaches this server-side: a live panel has no failure to
 * report until it has sent something, and the island owns the banner from that
 * point on. `error` is on this type's published states strip precisely because
 * it is the one appearance a reader cannot produce on demand.
 */
const renderSpecimenErrorBanner = (labels: AiChatLabels): ReactElement => (
  <div
    data-testid="chat-error"
    role="alert"
    className={computeAiChatErrorClasses()}
  >
    <span>{labels.failure}</span>
  </div>
)

/**
 * The prompt chips, drawn UNDER the composer and OUTSIDE it.
 *
 * Under rather than over so the composer sits in the same place whether or not
 * a chat declares suggestions. Outside the `<form>` rather than inside it
 * because a `button` inside a form is a submit control, and a chip must fill
 * the input and stop there — a chip that sent would fire a model call from a
 * misclick, on a prompt the reader never confirmed.
 *
 * The skeleton draws it so the chips are present before hydration and the panel
 * does not shift when the island mounts; the island draws it again because a
 * chip needs a click handler, and both read the same recipe so neither repaints
 * the other.
 */
const renderSuggestionStrip = (
  suggestions: ReadonlyArray<string>,
  labels: AiChatLabels
): ReactElement => (
  <div
    data-ai-chat-suggestions
    role="group"
    // The strip's own accessible name: without it a screen-reader user meets a
    // run of unexplained buttons after the composer.
    aria-label={labels.suggestions}
    className={computeAiChatSuggestionStripClasses()}
  >
    {suggestions.map((prompt, index) => (
      <button
        // The prompt alone is not a key: two identical prompts are a config
        // mistake, not a crash, and the index keeps them distinct.
        key={`${index}:${prompt}`}
        type="button"
        data-testid="chat-suggestion"
        className={SUGGESTION_CHIP}
      >
        {prompt}
      </button>
    ))}
  </div>
)

/** The attach control of an `allowAttachments` chat, as the island draws it. */
const renderAttachSkeleton = (composer: AiChatComposerLabels): ReactElement => (
  <button
    type="button"
    data-slot="input-group-button"
    data-testid="chat-attach"
    aria-label={composer.attachFile}
    className={ATTACH_BUTTON}
  >
    {composer.attach}
  </button>
)

/**
 * The push-to-talk button of a `voiceInput` chat, inert until the island
 * mounts and drawn now only so the composer does not shift when it does.
 */
const renderVoiceSkeleton = (composer: AiChatComposerLabels): ReactElement => (
  <button
    type="button"
    data-slot="input-group-button"
    data-testid="chat-voice"
    aria-label={composer.holdToTalk}
    aria-pressed="false"
    disabled
    className={ATTACH_BUTTON}
  >
    {composer.talk}
  </button>
)

/**
 * The composer's `block-end` addon. `type="button"` on a specimen's send, and
 * it is the whole of what makes the drawing inert: a specimen's row carries no
 * `action` and no `method`, so a submit control is the only remaining way this
 * markup could put something on the wire — and [internal ref] A3 clause 1 permits a
 * specimen form element only while it has none. A live panel keeps its
 * submit; the island is what gives that submit somewhere to go.
 */
const renderControlsSkeleton = (
  { allowAttachments, voiceInput, labels }: AiChatSkeletonInput,
  specimen: AiChatSpecimenStatus | undefined
): ReactElement => (
  <div
    role="group"
    data-slot="input-group-addon"
    data-align="block-end"
    className={computeInputGroupAddonClasses({ align: 'block-end' })}
  >
    {allowAttachments && renderAttachSkeleton(labels.composer)}
    {voiceInput !== undefined && renderVoiceSkeleton(labels.composer)}
    <button
      type={specimen === undefined ? 'submit' : 'button'}
      data-slot="input-group-button"
      data-ai-chat-send
      data-testid="chat-send"
      disabled
      className={SEND_BUTTON}
    >
      {labels.composer.send}
    </button>
  </div>
)

/** Static chat skeleton — the island client upgrades this on hydration. */
export const renderSkeletonBody = (
  input: AiChatSkeletonInput,
  specimen: AiChatSpecimenStatus | undefined
): ReactElement => {
  const { placeholder, suggestions, labels, draftParam } = input
  return (
    <>
      {/* The transcript frame (`message-scroller`) — empty until the island
        replays history or a turn is sent. */}
      <div
        data-slot="message-scroller"
        data-ai-chat-messages
        data-testid="chat-messages"
        role="log"
        aria-label={labels.log}
        aria-live="polite"
        aria-relevant="additions"
        className={`chat-messages ${computeMessageScrollerClasses()} ${AI_CHAT_TRANSCRIPT_FIT}`}
      />

      {specimen === 'error' && renderSpecimenErrorBanner(labels)}

      {/* The composer — the island upgrades this to a live form. A live
        panel's row is a POST form, so no submit that slips past the disabled
        Send can put the message in the address; a specimen keeps no method
        ([internal ref] A3 clause 1: a specimen form element carries neither). */}
      <form
        data-ai-chat-form
        {...(specimen === undefined && { method: 'post' })}
        className={computeAiChatComposerClasses()}
      >
        <label
          htmlFor="ai-chat-input"
          className="sr-only"
        >
          {labels.composer.message}
        </label>
        <div
          data-slot="input-group"
          role="group"
          className={computeInputGroupClasses()}
        >
          <textarea
            id="ai-chat-input"
            rows={1}
            data-slot="input-group-control"
            data-ai-chat-input
            data-testid="chat-input"
            name="message"
            {...(specimen === undefined &&
              draftParam !== undefined && {
                'data-draft-param': draftParam,
              })}
            placeholder={placeholder}
            className={computeAiChatTextareaClasses()}
          />
          {renderControlsSkeleton(input, specimen)}
        </div>
      </form>

      {suggestions !== undefined && renderSuggestionStrip(suggestions, labels)}
    </>
  )
}
