/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prompt-suggestion chips for the `ai-chat` island.
 *
 * The hydrated twin of the strip `ai-chat-component.tsx` renders into the SSR
 * skeleton. Both read `computeAiChatSuggestionStripClasses` and the outlined
 * small button, which is what stops the panel repainting the moment the island
 * mounts; what this side adds is the one thing markup cannot carry — a click
 * handler.
 *
 * It FILLS, it does not send. A chip lives outside the `<form>` and is
 * `type="button"`, so a click puts its text in the composer and leaves the send
 * to the reader, who can edit it first. A chip that submitted would read as
 * "faster" and would fire a model call from a misclick, on a prompt nobody
 * confirmed.
 *
 * The chip's visible text IS the text inserted — there is no `{ label, prompt }`
 * split — so a reader can predict what a click will put in the box.
 */

import { useCallback } from 'react'
import { computeAiChatSuggestionStripClasses } from '@/presentation/design/ai-chat-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import type { ReactElement } from 'react'

/**
 * The small outlined button — the one variant whose fill is the surface behind
 * it, so a row of chips reads as offers rather than as competing send buttons.
 */
const SUGGESTION_CHIP = computeButtonDefaultClasses({ variant: 'outline', size: 'sm' })

/**
 * The strip's own accessible name, matching the skeleton's. Without it a
 * screen-reader user meets a run of unexplained buttons after the composer.
 */
const SUGGESTIONS_GROUP_LABEL = 'Suggested questions'

interface SuggestionChipProps {
  readonly prompt: string
  readonly onSelect: (prompt: string) => void
}

/**
 * One chip.
 *
 * A component rather than an inline arrow in the parent's `map`, so each chip
 * owns a stable handler instead of allocating a new closure on every render of
 * the composer — the draft changes on every keystroke, and the strip sits
 * beside it.
 */
function SuggestionChip({ prompt, onSelect }: SuggestionChipProps): ReactElement {
  const handleClick = useCallback(() => onSelect(prompt), [onSelect, prompt])

  return (
    <button
      type="button"
      data-testid="chat-suggestion"
      onClick={handleClick}
      className={SUGGESTION_CHIP}
    >
      {prompt}
    </button>
  )
}

interface SuggestionStripProps {
  readonly suggestions: ReadonlyArray<string> | undefined
  readonly onSelect: (prompt: string) => void
}

/**
 * The strip, or nothing at all.
 *
 * A chat declaring no suggestions emits no group — not an empty labelled one,
 * which would be a name in the accessibility tree announcing nothing.
 */
export function SuggestionStrip({
  suggestions,
  onSelect,
}: SuggestionStripProps): ReactElement | undefined {
  if (suggestions === undefined || suggestions.length === 0) return undefined

  return (
    <div
      data-ai-chat-suggestions
      role="group"
      aria-label={SUGGESTIONS_GROUP_LABEL}
      className={computeAiChatSuggestionStripClasses()}
    >
      {suggestions.map((prompt, index) => (
        // The prompt alone is not a key: two identical prompts are a config
        // mistake, not a crash, and the index keeps them distinct.
        <SuggestionChip
          key={`${index}:${prompt}`}
          prompt={prompt}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
