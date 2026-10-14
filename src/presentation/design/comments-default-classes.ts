/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui item, avatar and textarea (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `comments` thread, drawn on shadcn/ui's anatomy (base-nova).
 *
 * The server-rendered section and the hydrated thread both read this module,
 * so the frame, the empty line and the composer cannot jump on mount.
 *
 * - The thread is ONE outlined frame whose rows are separated by rules.
 * - Each comment is an `item` aligned to the start: an `item-media` holding the
 *   author's `avatar`, then an `item-content` whose `item-title` carries the
 *   author and a muted time, the text under it at reading size and unclamped.
 *   A reply is indented under a left rule and draws a smaller avatar.
 * - The composer is an `input-group` around its textarea, with the submit in a
 *   `block-end` addon (`input-group-default-classes.ts`).
 *
 * The item strings are base-nova's `itemVariants` at its default variant with
 * `items-start` in place of `items-center`: the merged item recipe carries no
 * alignment axis, and an island cannot resolve a class conflict at runtime.
 */

/** The thread frame: one outlined panel, its rows pad themselves. */
export const computeCommentThreadClasses = (): string =>
  'my-6 flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground'

/** The sort control's row, right-aligned above the first comment. */
export const computeCommentSortBarClasses = (): string =>
  'flex items-center justify-end gap-1.5 border-b border-border px-3 py-2 text-xs text-muted-foreground'

/** The sort `<select>`: a 24px field, it labels the list rather than collecting input. */
export const computeCommentSortSelectClasses = (): string =>
  'select-compact inline-flex h-6 w-auto items-center rounded-md border border-input bg-transparent px-2 py-0.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// ──────────────────────────────────────────────────────────────────────────────
// ITEMS
// ──────────────────────────────────────────────────────────────────────────────

/** A comment's depth: 0 on the thread, 1 for a reply. */
type Depth = { readonly depth?: number }

/**
 * One comment — base-nova's `Item`, aligned to the start, as a rule-separated
 * row of the frame. A reply is indented by its parent's avatar and gap and
 * hangs a rule down its left edge.
 */
export const computeCommentItemClasses = ({ depth = 0 }: Depth = {}): string =>
  [
    'group/item flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-sm outline-none',
    depth >= 1 ? 'ml-[42px] border-l-2 border-l-border pl-3' : '',
  ]
    .filter(Boolean)
    .join(' ')

/** base-nova's `ItemMedia` (default variant). */
export const computeCommentMediaClasses = (): string =>
  'flex shrink-0 items-center justify-center gap-2'

/** base-nova's `Avatar` root: 32px, 24px for a reply. */
export const computeCommentAvatarClasses = ({ depth = 0 }: Depth = {}): string =>
  `group/avatar relative flex shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten ${depth >= 1 ? 'size-6' : 'size-8'}`

/** base-nova's `AvatarFallback`: the author's initial. */
export const computeCommentAvatarFallbackClasses = ({ depth = 0 }: Depth = {}): string =>
  `flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground ${depth >= 1 ? 'text-xs' : 'text-sm'}`

/** base-nova's `ItemContent`: the title, the text, the actions. */
export const computeCommentBodyColumnClasses = (): string => 'flex min-w-0 flex-1 flex-col gap-1'

/**
 * base-nova's `ItemTitle`, one avatar tall.
 *
 * The item aligns its media and content to the TOP, which is right for a
 * comment of three lines and wrong for its first one: a title line set at its
 * own height sits above the avatar's centre. Giving it the avatar's height and
 * centring its content puts the author's name on the avatar's centre line.
 */
export const computeCommentMetaClasses = ({ depth = 0 }: Depth = {}): string =>
  `flex w-fit items-center gap-2 text-sm leading-snug font-medium ${depth >= 1 ? 'min-h-6' : 'min-h-8'}`

/** The author's name. */
export const computeCommentAuthorClasses = (): string => 'font-medium text-foreground'

/** The time, and the reply count: muted, the least important text in the row. */
export const computeCommentTimestampClasses = (): string =>
  'text-xs font-normal text-muted-foreground'

/** The comment itself, whole and at reading size. */
export const computeCommentTextClasses = (): string =>
  'text-sm leading-relaxed break-words text-foreground'

/** The reply / edit / delete row, as underlined words. */
export const computeCommentActionsClasses = (): string =>
  'flex gap-2.5 text-xs text-muted-foreground'

/** One action inside that row. */
export const computeCommentActionClasses = (): string =>
  'rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

/** "No comments yet", said once, quietly. */
export const computeCommentEmptyClasses = (): string => 'px-3 py-4 text-sm text-muted-foreground'

/** The row holding "Load more" or the page numbers. */
export const computeCommentPagerClasses = (): string => 'flex items-center gap-1 px-3 py-2'

// ──────────────────────────────────────────────────────────────────────────────
// COMPOSER
// ──────────────────────────────────────────────────────────────────────────────

/** The write-a-comment block at the foot of the thread. */
export const computeCommentFormClasses = (): string =>
  'flex flex-col gap-2 border-t border-border px-3 py-2.5'

/**
 * base-nova's `Textarea`, the guest form's comment field, drawn by the server
 * beside its name and email inputs.
 */
export const computeCommentComposerFieldClasses = (): string =>
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30'

/** base-nova's `InputGroupTextarea`: the textarea, its own frame handed to the group. */
export const computeCommentComposerTextareaClasses = (): string =>
  'flex field-sizing-content min-h-16 w-full flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-base shadow-none ring-0 outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-transparent'

/**
 * The `@` picker: a popover surface IN FLOW under the composer, since the
 * thread frame clips its overflow at its rounded corners.
 */
export const computeCommentMentionPickerClasses = (): string =>
  'flex max-h-56 min-w-40 flex-col overflow-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground ring-1 ring-foreground/10'

/** One person in it; the active one on the accent surface. */
export const computeCommentMentionOptionClasses = ({
  active,
}: {
  readonly active: boolean
}): string =>
  `flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`

/** "No matches" inside it. */
export const computeCommentMentionCaptionClasses = (): string =>
  'px-2 py-1 text-xs font-medium text-muted-foreground'

/** "Sign in to comment" — the composer's block, holding a link instead of a form. */
export const computeCommentSignedOutClasses = (): string =>
  'border-t border-border px-3 py-2.5 text-sm text-foreground'
