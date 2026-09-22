/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for `rich-text-editor` (wave R-E).
 *
 * This module owns the FRAME — the border, the toolbar, the counter, the slash
 * menu. How the content itself reads is the `.rte` block in
 * `infrastructure/css/theme/rich-text-styles.ts`, because that is a set of
 * descendant rules over markup the author types and no class on a wrapper can
 * express it.
 *
 * ## Home
 * `presentation/utils/recipes` because a rich-text field is drawn on both sides
 * of the `presentation-component` ↔ `presentation-island` boundary, and because
 * the directory is in `RECIPE_DIRS` (`arbitrary-var-safelist.ts`) so the `v(…)`
 * arbitrary values reach the compiler's safelist. A recipe written elsewhere
 * emits no CSS rule at all.
 *
 * ## Target
 * Canvas oracle: `variants.mjs:157` (`richEditor`, its four states and the
 * slash menu), `kit.mjs:103` (the specimen), `spec-fields.mjs:142-166` (the
 * toolbar, slash-menu, placeholder and length option rows).
 *
 * | part           | property               | value                     |
 * |----------------|------------------------|---------------------------|
 * | frame          | border / radius        | 1px border-strong · r4    |
 * | · focus        | border + ring          | primary + the house ring  |
 * | · invalid      | border                 | error-solid               |
 * | toolbar        | gap / padding / rule   | 2px · 4px 6px · bottom    |
 * | toolbar button | padding / size / radius| 2px 6px · 11px · r2       |
 * | body           | padding / size / lead  | 10px 12px · 13px · 1.6    |
 * | body           | min-height             | 56px                      |
 * | counter        | padding / size / tone  | 4px 12px · 11px · disabled|
 *
 * The frame sits on `border-strong`, one step darker than the panel rules
 * around it: it is a CONTROL, and a control's edge is the thing you aim at.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

/** The four states the drawing distinguishes. */
export type RichTextEditorState = 'default' | 'focus' | 'invalid' | 'disabled'

/**
 * The frame around the toolbar, the body and the counter.
 *
 * `focus-within` rather than `focus`: the thing that takes focus is the
 * contenteditable INSIDE the frame, so a ring on the frame itself would never
 * fire. That is why this shipped with no focus affordance at all — the editor
 * was the one control in the system that gave no sign it was ready for typing.
 */
export const computeRichTextFrameClasses = ({
  state,
}: { readonly state?: RichTextEditorState } = {}): string =>
  [
    'relative flex flex-col overflow-hidden border',
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    state === 'invalid'
      ? `border-[${v('sv-error-solid', T.errorSolid)}]`
      : `border-[${v('sv-border-strong', T.borderStrong)}]`,
    state === 'disabled' ? 'opacity-50' : '',
    'focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2',
    `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    `focus-within:ring-offset-[${v('sv-bg', T.bg)}]`,
    `focus-within:border-[${v('sv-primary', T.primary)}]`,
  ]
    .filter(Boolean)
    .join(' ')

/**
 * The toolbar strip.
 *
 * `gap-0.5` (2px), not `gap-1`. Formatting buttons are a KEYBOARD of related
 * marks, and the drawing packs them: at 4px apart a twelve-action toolbar
 * reads as twelve separate controls rather than one instrument.
 */
export const computeRichTextToolbarClasses = (): string =>
  ['flex flex-wrap gap-0.5 px-1.5 py-1', 'border-b', `border-[${v('sv-border', T.border)}]`].join(
    ' '
  )

/**
 * One formatting button.
 *
 * 11px in a 2×6 box on `radius-sm`, where this shipped at 12px in a 4×8 box on
 * `radius-base`. The smaller chip is what lets the whole toolbar sit inside a
 * 24px strip; at the old size the toolbar was taller than the two lines of
 * text it formats.
 *
 * The active state is a FILL and nothing else — no border, no colour. Which
 * marks are on is a fact about the cursor, not a consequence, so it does not
 * get to spend the palette's one accent.
 */
export const computeRichTextToolbarButtonClasses = ({
  active,
}: { readonly active?: boolean } = {}): string =>
  [
    'px-1.5 py-0.5 text-xs font-medium',
    `rounded-[${v('radius-sm', T.radiusSm)}]`,
    active === true
      ? `bg-[${v('sv-bg-subtle', T.bgSubtle)}] text-[${v('sv-fg', T.fg)}]`
      : `text-[${v('sv-fg-muted', T.fgMuted)}] hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  ].join(' ')

/**
 * The editable body.
 *
 * `rte` is the content stylesheet; the rest is the box it lives in. `min-h-14`
 * is 56px — two lines of 13px text plus the padding — which is the smallest
 * box that still reads as somewhere to write a paragraph rather than a line.
 */
export const computeRichTextBodyClasses = (): string =>
  ['rte min-h-14 px-3 py-2.5', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * The placeholder shown over an empty body.
 *
 * Positioned from the TOP-LEFT of the body box rather than at a fixed offset
 * from the frame: the old `top-12` was measured against a toolbar height that
 * has now changed, and a hardcoded offset breaks again the next time it does.
 *
 * That was always the intent and for a long time it was not the behaviour. An
 * `absolute` box with no offsets takes its STATIC position — and the frame is
 * `flex flex-col`, where an absolutely positioned child's static position is
 * the container's content-box corner rather than wherever its siblings left
 * off. So the prompt sat at the top of the FRAME, which is the toolbar, and
 * painted across every button on it: founder, _"le placeholder, il mange sur le
 * menu en haut… c'est cassé, c'est pas propre"_.
 *
 * Two halves make it true now, and both are needed. The prompt is wrapped with
 * the editable body in a `relative` box (`parts/rich-text-editor-field`), so
 * the body is its containing block; and `inset-x-0 top-0` pins it to that box's
 * top edge rather than leaving it to a static position — which, inside a plain
 * block wrapper, would now fall BELOW the body instead of above it. The
 * `px-3 py-2.5` it already carried is the body's own inset, which is what puts
 * the prompt ON the first line of text rather than near it.
 */
export const computeRichTextPlaceholderClasses = (): string =>
  [
    'pointer-events-none absolute inset-x-0 top-0 px-3 py-2.5 text-base',
    `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' ')

/**
 * The strip the editor's footer captions sit on, minus the tone that
 * distinguishes them.
 *
 * Both captions below occupy the SAME band under the same rule and differ only
 * in colour, so the band is described once. It was written out twice, and the
 * two spellings were identical only because nothing had yet moved the footer:
 * the next change to its padding or its rule would have had to find both for
 * the two captions to keep sharing a line.
 */
const bottomRuleCaption = (tone: string): string =>
  ['px-3 py-1 text-xs', 'border-t', `border-[${v('sv-border', T.border)}]`, tone].join(' ')

/**
 * The one error tone the editor's footer spends, named once so the counter and
 * the over-limit message cannot drift into two error colours — which is a
 * second vocabulary for one condition, not a second shade.
 */
const BOTTOM_RULE_ERROR_TONE = `text-[${v('sv-error-fg', T.errorFg)}]`

/**
 * The character count on the bottom rule.
 *
 * `atLimit` swaps the quiet caption tone for the error tone the over-limit
 * message below also spends, because the two say the same thing about the same
 * field. The counter is the ONLY signal a capped editor gives once `maxLength`
 * starts refusing keystrokes: without it the editor simply stops responding and
 * the reader is told nothing.
 */
export const computeRichTextCounterClasses = ({
  atLimit,
}: { readonly atLimit?: boolean } = {}): string =>
  bottomRuleCaption(
    atLimit === true ? BOTTOM_RULE_ERROR_TONE : `text-[${v('sv-fg-disabled', T.fgDisabled)}]`
  )

/** The over-limit message, on the same rule and in the same tone as a full counter. */
export const computeRichTextOverLimitClasses = (): string =>
  bottomRuleCaption(BOTTOM_RULE_ERROR_TONE)

/**
 * The slash menu.
 *
 * The system's one menu shape — `radius-md`, `p-1`, `shadow-md` — rather than a
 * shape of its own. It shipped with `radius-base` and an overlay ground; a menu
 * that appears from a keystroke should look like a menu that appears from a
 * click.
 */
export const computeRichTextSlashMenuClasses = (): string =>
  [
    'absolute z-10 flex flex-col gap-px p-1',
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `rounded-[${v('radius-md', T.radiusMd)}]`,
    // `shadow-md`, NOT `sv-shadow-md`: the elevation ramp is emitted under the
    // plain `--shadow-*` names. `--sv-shadow-*` is declared nowhere, so a recipe
    // spending it has a dead override channel that always falls through to the
    // literal — the same trap the radius ramp carried until it was corrected.
    `shadow-[${v('shadow-md', T.shadowMd)}]`,
  ].join(' ')

/** One entry in it. */
export const computeRichTextSlashItemClasses = ({
  active,
}: { readonly active?: boolean } = {}): string =>
  [
    'cursor-pointer px-2 py-1.5 text-sm',
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    active === true
      ? `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`
      : `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' ')

/** "No matches" inside the slash menu. */
export const computeRichTextSlashEmptyClasses = (): string =>
  ['px-2 py-1.5 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')
