/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui bubble, textarea and input-group (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The parts `ai-chat` draws itself once it is composed from the conversation
 * types (`message-scroller`, `message`, `marker`, `attachment`) and the
 * `input-group` composer. Those types keep their own recipes, and the chat
 * reads them directly; this module holds only what the chat adds around them:
 * the panel, the turn surface, the composer's place in the panel, and the
 * failure line.
 *
 * Read by BOTH the server skeleton and the hydrated island, so the panel does
 * not repaint when the island mounts. Every value is a shadcn role utility;
 * no part of the chat reads a `--sv-*` property.
 */

import { computePartButtonClasses } from './button-variant-classes'

/**
 * The chat panel. The one box `chatHeight` sizes: the renderer sets the height
 * inline and `overflow-hidden` makes it a clip, so the transcript, the
 * composer and the chips all fit inside it.
 */
export const computeAiChatPanelClasses = (): string =>
  'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground'

/**
 * The transcript's place in the panel, added to the `message-scroller` frame:
 * it takes the room the composer leaves (`flex-1`) and may shrink below its
 * content (`min-h-0`), so the excess scrolls instead of pushing the composer
 * out of the clip.
 */
export const AI_CHAT_TRANSCRIPT_FIT = 'flex-1 min-h-0'

/** One turn's surface, base-nova `bubble`: as wide as what it holds, set to its turn's side. */
export const computeAiChatBubbleClasses = (): string =>
  'group/bubble relative flex w-fit max-w-full min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end'

/**
 * The bubble's content. The reader's turns paint the primary role (base-nova
 * `default`), the assistant's the muted role (base-nova `muted`).
 */
export const computeAiChatBubbleContentClasses = (role: 'user' | 'assistant'): string =>
  `w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap ${
    role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
  }`

/**
 * An answer drawn from its Markdown: the assistant bubble, with the prose
 * spacing the rendered blocks need — paragraphs and lists apart, list markers
 * shown, links underlined, code set apart — instead of the typed turn's
 * preserved whitespace, which would double every line break of the markup.
 */
export const computeAiChatAnswerContentClasses = (): string =>
  computeAiChatBubbleContentClasses('assistant')
    .replace('whitespace-pre-wrap', 'whitespace-normal')
    .concat(
      ' [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_p+*]:mt-2 [&_ul+*]:mt-2 [&_ol+*]:mt-2 [&_a]:underline [&_a]:underline-offset-3 [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background [&_pre]:p-2'
    )

/** The decisions on a held tool call, drawn after the line's words. */
export const computeAiChatToolDecisionClasses = (variant: 'default' | 'outline'): string =>
  `${computePartButtonClasses({ variant, size: 'sm' })} shadow-none`

/** The three dots of the live "responding" marker. */
export const AI_CHAT_RESPONDING_DOT =
  'size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none'

/** A failed turn: a line in the destructive role above the composer, on no surface. */
export const computeAiChatErrorClasses = (): string =>
  'flex shrink-0 items-center gap-2 px-4 py-1.5 text-sm leading-snug wrap-break-word text-destructive'

/** The composer form: the input group's padding inside the panel. */
export const computeAiChatComposerClasses = (): string => 'shrink-0 px-3 pb-3'

/**
 * The message field, base-nova `InputGroupTextarea` on `Textarea`: one line
 * tall at rest, growing with what is typed up to a few lines, then scrolling.
 */
export const computeAiChatTextareaClasses = (): string =>
  'flex field-sizing-content max-h-32 min-h-10 w-full min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-base shadow-none ring-0 outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50 md:text-sm dark:bg-transparent'

/**
 * A composer control: an `input-group-button` (base-nova draws it with
 * `Button`), quiet unless it is the send. `shadow-none` is the one class the
 * input group adds to the button it hosts.
 */
export const computeAiChatComposerButtonClasses = (variant: 'ghost' | 'default'): string =>
  `${computePartButtonClasses({ variant, size: 'sm' })} shadow-none`

/** The chip strip under the composer, outside the form so a chip never submits. */
export const computeAiChatSuggestionStripClasses = (): string =>
  'flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-3'
