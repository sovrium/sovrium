/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `rich-text-editor` frame, drawn on shadcn/ui's anatomy (base-nova).
 *
 * Tiptap stays; what this module draws is around it:
 *
 * - the frame is an `input-group` in its column form, ringed while the body —
 *   the group's `input-group-control` — has focus
 *   (`computeInputGroupFrameClasses`);
 * - the toolbar is a `block-start` addon of ghost toggles, one lucide glyph and
 *   one name each, pressed ones on the `muted` surface, with a separator
 *   between groups of actions;
 * - the body takes the textarea's padding.
 *
 * How the content itself reads is the `.rte` block in
 * `infrastructure/css/theme/rich-text-styles.ts`: descendant rules over markup
 * the author types, which no class on a wrapper can express.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import {
  computeInputGroupBlockAddonClasses,
  computeInputGroupFrameClasses,
} from '@/presentation/design/input-group-block-classes'

/**
 * The frame around the toolbar, the body and the counter: an input group,
 * which its `block-start` addon turns into a column. Over the limit, the body
 * carries `aria-invalid` and the group's own rule edges the frame in the
 * destructive colour. Each row it holds spans the full width itself.
 */
export const computeRichTextFrameClasses = (): string =>
  `${computeInputGroupFrameClasses()} overflow-hidden`

/** The box the body and its placeholder share, across the frame. */
export const computeRichTextBodyBoxClasses = (): string => 'relative w-full'

/** The toolbar: a `block-start` addon, ruled off from the body. */
export const computeRichTextToolbarClasses = (): string =>
  `${computeInputGroupBlockAddonClasses({ align: 'block-start' })} flex-wrap gap-0.5 border-b border-border`

/** One action: a ghost toggle on base-nova's small icon button, muted while pressed. */
export const computeRichTextToolbarButtonClasses = (): string =>
  `${computePartButtonClasses({ variant: 'ghost', size: 'icon-sm' })} text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground`

/** The separator between two groups of actions. */
export const computeRichTextSeparatorClasses = (): string =>
  'mx-1 h-4 w-px shrink-0 self-center bg-border'

/** The editable body, on the textarea's padding. */
export const computeRichTextBodyClasses = (): string =>
  'rte min-h-14 px-2.5 py-2 text-base text-foreground outline-none md:text-sm'

/** The placeholder over an empty body, pinned to the body's first line. */
export const computeRichTextPlaceholderClasses = (): string =>
  'pointer-events-none absolute inset-x-0 top-0 px-2.5 py-2 text-base text-muted-foreground md:text-sm'

/** The band under the body the counter and the over-limit message share. */
const footCaption = (tone: string): string =>
  `w-full border-t border-border px-2.5 py-1 text-xs ${tone}`

/** The character count; at the limit, in the error tone the message also spends. */
export const computeRichTextCounterClasses = ({
  atLimit,
}: { readonly atLimit?: boolean } = {}): string =>
  footCaption(atLimit === true ? 'text-error-fg' : 'text-muted-foreground')

/** The over-limit message. */
export const computeRichTextOverLimitClasses = (): string => footCaption('text-error-fg')

/** The slash menu: a popover surface. */
export const computeRichTextSlashMenuClasses = (): string =>
  'absolute z-10 flex min-w-40 flex-col gap-px rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10'

/** One entry in it; the active one on the accent surface. */
export const computeRichTextSlashItemClasses = ({
  active,
}: { readonly active?: boolean } = {}): string =>
  `cursor-default rounded-md px-2 py-1.5 text-sm ${active === true ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`

/** "No matches" inside the slash menu. */
export const computeRichTextSlashEmptyClasses = (): string =>
  'px-2 py-1.5 text-sm text-muted-foreground'
