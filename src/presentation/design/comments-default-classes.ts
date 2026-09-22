/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for `comments` (wave R-E).
 *
 * ## Why it moved here
 * These lived in `islands/recipes/specialty-islands-default-classes.ts`, which
 * `ui/sections/rendering/component-registry/social-components.tsx` cannot
 * import across the `presentation-component` ↔ `presentation-island` boundary.
 * So the guest form the server renders and the form the island hydrates were
 * styled from two different sources, and had already drifted: the server drew
 * its textarea `min-h-[100px]`, the island drew the same control
 * `min-h-[80px]`. A 20px jump on mount, from two literals nothing compared.
 *
 * ## The shape change, and why it is the point
 * A thread was a bordered card holding bordered cards. The canvas
 * (`variants.mjs:174`) draws it as ONE frame whose rows are separated by
 * rules — the same structure as a table, which is what a thread is. Two
 * reasons this is not a preference:
 *
 *  - Card-in-card is out of contract. R-B removed it everywhere else; a
 *    comment thread was the last place it survived, and it made a five-comment
 *    thread read as five documents rather than one conversation.
 *  - The rules do the separating for free, so every comment gets back the
 *    16px of padding the nested borders were spending.
 *
 * The row rule is `bg-subtle`, one step lighter than the frame's own `border`.
 * That is deliberate in the drawing: an internal division should be quieter
 * than the boundary of the thing it divides.
 *
 * ## Target
 * Canvas oracle: `variants.mjs:174` (`commentThread` with its sort bar,
 * items, replies, pager, composer, empty and signed-out states),
 * `kit.mjs:94` (the specimen), `spec-fields.mjs:77-110` (the option rows).
 *
 * | part      | property                | value                          |
 * |-----------|-------------------------|--------------------------------|
 * | frame     | border / radius         | 1px border · r6                |
 * | sort bar  | padding / size / rule   | 8px 12px · 11px muted · bottom |
 * | item      | padding / gap / rule    | 10px 12px · 10px · bottom, subtle |
 * | avatar    | size                    | 24px                           |
 * | author    | size / weight           | 12px · 500                     |
 * | time      | size / tone             | 11px · fg-disabled             |
 * | body      | size / leading          | 13px · 1.5                     |
 * | actions   | size / tone / decoration| 11px · muted · underline       |
 * | reply     | indent / rule           | 34px · 2px left, border        |
 * | composer  | padding / ground / rule | 10px 12px · page ground · top  |
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// FRAME
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The thread frame.
 *
 * No padding and no gap: every row inside pads itself, so a row's rule can run
 * the full width of the frame the way a table's does. The old recipe's `p-4
 * gap-3` is what forced each comment to carry its own border to look separated.
 */
export const computeCommentThreadClasses = (): string =>
  [
    'my-6 flex flex-col overflow-hidden',
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `rounded-[${v('radius-md', T.radiusMd)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

/** The sort control's row, right-aligned above the first comment. */
export const computeCommentSortBarClasses = (): string =>
  [
    'flex items-center justify-end gap-1.5 px-3 py-2 text-xs',
    'border-b',
    `border-[${v('sv-border', T.border)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' ')

/**
 * The sort `<select>` itself — a 24px field, not a 36px one.
 *
 * `variants.mjs:174` shrinks it because it labels the list rather than
 * collecting input: at full field height it would out-weigh the first comment
 * underneath it.
 */
export const computeCommentSortSelectClasses = (): string =>
  [
    'inline-flex h-6 w-auto items-center px-2 text-xs',
    'border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ITEMS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * One comment — a rule-separated row, not a card.
 *
 * The `depth` axis indents a reply by 34px and hangs a 2px rule down its left
 * edge. 34px is not arbitrary: it is the 24px avatar plus the 10px gap after
 * it, so a reply's text starts exactly where its parent's text starts and the
 * thread reads as a single left-hand column with one step in it.
 */
export const computeCommentItemClasses = ({
  depth = 0,
}: { readonly depth?: number } = {}): string =>
  [
    'flex items-start gap-2.5 px-3 py-2.5',
    'border-b',
    // One step lighter than the frame's own border: an internal division
    // should be quieter than the boundary of the thing it divides.
    `border-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    depth >= 1 ? `ml-[34px] border-l-2 border-l-[${v('sv-border', T.border)}] pl-3` : '',
  ]
    .filter(Boolean)
    .join(' ')

/** The circle carrying an author's initial. */
export const computeCommentAvatarClasses = (): string =>
  [
    'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  ].join(' ')

/** The column beside the avatar: meta, body, actions. */
export const computeCommentBodyColumnClasses = (): string => 'flex min-w-0 flex-1 flex-col gap-1'

/**
 * The author + time + moderation row — the row's FIRST LINE, set on the
 * avatar's own step so the two read as one line.
 *
 * `leading-6` is the whole of it, and it is not a spacing tweak: the row aligns
 * the avatar and the body column at their TOP edges, which is right for a
 * comment that runs to three lines and wrong for the first line of one. At the
 * inherited step the author's line box came out 18px against a 24px circle, so
 * the name sat 3px high of the avatar's centre and the pair read as two lines.
 *
 * Giving this line the avatar's height centres the name in it, and centred in
 * a box the same height, starting at the same y, IS centred on the avatar. The
 * `6` is the avatar's own `size-6` deliberately — both resolve through
 * `--spacing`, so an authored density moves the circle and the line it is
 * aligned to together rather than pulling them apart.
 *
 * `items-baseline` stays: the 11px timestamp beside a 14px name should sit on
 * the name's baseline, not on its centre.
 */
export const computeCommentMetaClasses = (): string =>
  ['flex items-baseline gap-2 text-sm leading-6', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/** The author's name — the only part of the meta row at full strength. */
export const computeCommentAuthorClasses = (): string => 'font-medium'

/**
 * The timestamp.
 *
 * 11px on the disabled foreground: it is the least important thing in the row
 * and should be legible without ever being read first.
 */
export const computeCommentTimestampClasses = (): string =>
  ['text-xs', `text-[${v('sv-fg-disabled', T.fgDisabled)}]`].join(' ')

/** The comment itself — the one part of the row at reading size. */
export const computeCommentTextClasses = (): string =>
  ['text-base leading-relaxed', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * The reply / edit / delete row.
 *
 * Underlined text rather than buttons. Three buttons under every comment
 * would out-weigh the comment; underlined words say "these are actions" at a
 * quarter of the visual cost, which is the trade [internal ref] D2 asks for on a
 * surface this repetitive.
 */
export const computeCommentActionsClasses = (): string =>
  ['flex gap-2.5 text-xs', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/** One action inside that row. */
export const computeCommentActionClasses = (): string =>
  [
    'underline underline-offset-2',
    `hover:text-[${v('sv-fg', T.fg)}]`,
    'focus-visible:outline-none focus-visible:ring-2',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    `rounded-[${v('radius-sm', T.radiusSm)}]`,
  ].join(' ')

/** "No comments yet" — what this is, said once, quietly. */
export const computeCommentEmptyClasses = (): string =>
  ['px-3 py-4.5 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/** The row holding "Load more" or the page numbers. */
export const computeCommentPagerClasses = (): string => 'flex items-center gap-1 px-3 py-2'

// ──────────────────────────────────────────────────────────────────────────────
// COMPOSER
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The write-a-comment block at the foot of the thread.
 *
 * On the PAGE ground rather than the raised one — the inverse of the rows
 * above it, which is what makes it read as a well you write into rather than
 * as one more comment. Its top rule is the frame's `border`, not the rows'
 * lighter one, because it ends the list rather than dividing it.
 */
export const computeCommentFormClasses = (): string =>
  [
    'flex flex-col gap-2 px-3 py-2.5',
    'border-t',
    `border-[${v('sv-border', T.border)}]`,
    `bg-[${v('sv-bg', T.bg)}]`,
  ].join(' ')

/**
 * The composer's textarea.
 *
 * 64px tall on both surfaces. Before R-E the server drew 100px and the island
 * drew 80px from two unrelated literals, so the box shrank by a fifth the
 * moment the page finished loading.
 */
export const computeCommentComposerFieldClasses = (): string =>
  [
    'block h-16 w-full resize-y px-3 py-2 text-base',
    'border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
  ].join(' ')

/** "Sign in to comment" — the same block, holding a link instead of a form. */
export const computeCommentSignedOutClasses = (): string =>
  [
    'px-3 py-2.5 text-sm',
    'border-t',
    `border-[${v('sv-border', T.border)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')
