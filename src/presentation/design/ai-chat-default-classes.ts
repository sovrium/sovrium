/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for `ai-chat` (wave R-E).
 *
 * ## Why it moved here
 * These lived in `islands/recipes/specialty-islands-default-classes.ts`, which
 * `ui/sections/rendering/component-registry/ai-chat-component.tsx` cannot
 * import — `[internal ref]` forbids
 * `presentation-component → presentation-island`. So the SSR skeleton carried a
 * hand-written transcription of the recipe (eight class literals) that had to
 * be kept in sync by hand and was not, and the panel repainted on hydration.
 * `presentation/utils/recipes` is the one directory both sides may import; the
 * kpi and button modules are here for the same reason.
 *
 * ## Safelist
 * This directory is in `RECIPE_DIRS` (`arbitrary-var-safelist.ts`), so the
 * `v(…)` template literals reach the compiler's `@source inline(...)` list.
 *
 * ## Target
 * Canvas oracle: `variants.mjs:131` (`ai-chat`, its three states and the
 * `message` variant), `kit.mjs:101` (the specimen).
 *
 * | part            | property              | value                       |
 * |-----------------|-----------------------|-----------------------------|
 * | panel           | border / radius       | 1px border · r6             |
 * | body            | padding / gap         | 12px · 8px                  |
 * | bubble          | padding / size        | 6px 10px · 12px             |
 * | bubble (user)   | align / fill / corner | end · primary · tail bottom-right |
 * | bubble (asst)   | align / fill / corner | start · bg-subtle · tail bottom-left |
 * | bubble          | max-width             | 70%                         |
 * | composer        | border-top / padding  | 1px border · 8px 12px       |
 * | composer field  | chrome                | none — the row is the boundary |
 * | send            | —                     | the small primary button    |
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// PANEL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The chat panel.
 *
 * `radius-md`, not `radius-lg`: `variants.mjs:131` frames the chat with the
 * same 6px the rest of the system gives a bounded panel. Bounded, never lifted
 * — elevation is reserved for a surface that genuinely floats.
 *
 * This is the ONE box that `chatHeight` sizes. The renderer puts the author's
 * height on it as an inline style, and `overflow-hidden` makes that height a
 * clip rather than a suggestion — so everything the panel contains has to fit
 * inside it, and nothing below may size itself from `chatHeight` a second time.
 * See {@link computeAiChatMessageListClasses}, which is how the transcript
 * yields the room the composer needs.
 */
export const computeAiChatContainerClasses = (): string =>
  [
    'flex h-full flex-col overflow-hidden',
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `rounded-[${v('radius-md', T.radiusMd)}]`,
  ].join(' ')

/**
 * The scrolling transcript between the header and the composer.
 *
 * `flex-1 min-h-0 overflow-y-auto` is a single behaviour in three parts, and
 * dropping any one of them pushes the composer out of the panel:
 *
 *  - `flex-1` takes the room the composer and the chip strip have not claimed,
 *    which is what makes the transcript the part that grows.
 *  - `min-h-0` lets it also SHRINK. A flex item's default `min-height: auto` is
 *    a floor at its content's height, and a transcript has no ceiling — without
 *    this the log grows past the panel and the rows under it are laid out
 *    beyond the clip. The floor is nominally already zero here because
 *    `overflow-y` is not `visible`, so this is belt to that braces: it keeps
 *    the invariant readable, and true if the overflow below ever changes.
 *  - `overflow-y-auto` is where the excess goes — the transcript scrolls
 *    itself instead of displacing its neighbours.
 *
 * The composer and the chip strip are `shrink-0` for the other half of the
 * same contract: they keep their intrinsic height and the log absorbs the rest.
 * That is what `[internal ref]` measures, and it is why neither this log
 * nor the island that fills it may carry a height of its own — `chatHeight`
 * belongs to {@link computeAiChatContainerClasses} and to nothing else.
 */
export const computeAiChatMessageListClasses = (): string =>
  [
    'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// BUBBLES
// ──────────────────────────────────────────────────────────────────────────────

/** Schema-aligned vocabulary for the message role axis. */
export type AiChatMessageRole = 'user' | 'assistant' | 'system'

/**
 * The bubble's asymmetric corner — the one mark that says who is speaking.
 *
 * `10px 10px 2px 10px` for the user, mirrored for the assistant: three soft
 * corners and one nearly square one, pointing back at its own side of the
 * panel. `variants.mjs:131` draws it this way in every state, and it is what
 * lets a transcript be read at a glance without reading it — alignment alone
 * fails the moment a message is long enough to fill the width.
 *
 * Spelled as a literal rather than through {@link withVarFallback} because it
 * is a SHAPE, not a token: a theme that widens `radius-md` should not turn the
 * tail into a fourth round corner and erase the distinction.
 */
const BUBBLE_TAIL: Record<AiChatMessageRole, string> = {
  user: 'rounded-[10px_10px_2px_10px]',
  assistant: 'rounded-[10px_10px_10px_2px]',
  system: `rounded-[${v('radius-md', T.radiusMd)}]`,
}

const BUBBLE_BASE = 'w-fit max-w-[70%] px-2.5 py-1.5 text-sm leading-snug break-words'

const BUBBLE_ROLE: Record<AiChatMessageRole, string> = {
  user: [
    'ml-auto',
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
  ].join(' '),
  // No border. The fill already separates the bubble from the panel, and a
  // rule around a filled shape is the second boundary [internal ref] D2 removes.
  assistant: [
    'mr-auto',
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' '),
  // A system line is not a speaker, so it is not given a speaker's shape: no
  // fill, no tail, centred and muted. It reports on the conversation rather
  // than taking part in it.
  system: ['mx-auto text-center', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' '),
}

/**
 * One message.
 *
 * `max-w-[70%]` rather than 80: a reply that runs the full width of the panel
 * stops reading as one side of a conversation, and 70 is where the drawing
 * puts it.
 */
export const computeAiChatMessageBubbleClasses = ({
  role = 'assistant',
}: {
  readonly role?: AiChatMessageRole
} = {}): string => [BUBBLE_BASE, BUBBLE_TAIL[role], BUBBLE_ROLE[role]].join(' ')

/**
 * A failed turn — a line of red text above the composer, on no surface at all.
 *
 * Not a bubble, and since the 2026-09-16 review not a card either. It used to
 * be the drawing's bordered error-toned block at `w-fit max-w-[70%]`, and at
 * that width the sentence wrapped inside a pink box tight enough that the words
 * touched both edges. The founder's call was to delete the box rather than pad
 * it: no fill, no rule, no corner radius, and no bubble width to wrap against.
 *
 * What survives is the part that carries the meaning — the error FOREGROUND,
 * which is the only thing telling a reader this is a failure rather than an
 * answer — and the recovery affordance beside it, which is what an error state
 * owes the reader ([internal ref] D4).
 *
 * This is also [internal ref] D2 applied one step further than the assistant bubble
 * already applies it: a fill and a rule are two boundaries, and here neither is
 * needed, because the composer's own top rule is already the edge this line
 * sits above.
 */
export const computeAiChatErrorClasses = (): string =>
  ['px-3 py-1.5 text-sm leading-snug break-words', `text-[${v('sv-error-fg', T.errorFg)}]`].join(
    ' '
  )

/**
 * The caret that trails a streaming answer.
 *
 * A solid 6×12 block on the foreground, not a spinner: a spinner says "waiting",
 * and a streaming answer is not waiting — it is arriving, one token at a time,
 * and the caret sits exactly where the next one will land.
 */
export const computeAiChatStreamingCaretClasses = (): string =>
  ['ml-0.5 inline-block h-3 w-1.5 align-middle', `bg-[${v('sv-fg', T.fg)}]`].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// COMPOSER
// ──────────────────────────────────────────────────────────────────────────────

/** The row pinned under the transcript. */
export const computeAiChatInputRowClasses = (): string =>
  [
    'flex shrink-0 items-center gap-1.5 px-3 py-2',
    'border-t',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  ].join(' ')

/**
 * The field you type into — deliberately WITHOUT chrome of its own.
 *
 * `variants.mjs:131` draws a bare line here, and the reason holds up: a
 * bordered input inside a bordered row inside a bordered panel is three nested
 * boxes for one text cursor. The row's top rule is already the boundary, so
 * the field only needs to claim the width and hold a placeholder.
 *
 * The focus ring stays — it is the affordance, not the border — but it is
 * drawn inset so it does not overhang the panel's own edge.
 */
export const computeAiChatInputClasses = (): string =>
  [
    'min-w-0 flex-1 bg-transparent text-sm',
    `text-[${v('sv-fg', T.fg)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PROMPT SUGGESTIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The chip strip pinned under the composer.
 *
 * It shares the composer's fill and sits INSIDE the composer's boundary rather
 * than drawing a second rule of its own: the row's top border already separates
 * the transcript from everything below it, and a chip strip is part of the
 * composer, not a third region. `flex-wrap` because the author writes prompts,
 * not chip labels — three of them rarely fit one line of a 400px panel, and a
 * horizontal scroller would hide the third behind an edge.
 *
 * Read by BOTH the SSR skeleton and the hydrated island, which is the whole
 * reason this module exists: the strip is drawn twice and must not repaint on
 * mount.
 */
export const computeAiChatSuggestionStripClasses = (): string =>
  [
    'flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-2',
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  ].join(' ')
