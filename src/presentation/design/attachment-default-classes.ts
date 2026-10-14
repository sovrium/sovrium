/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cva } from 'class-variance-authority'

/**
 * Adapted from shadcn/ui attachment (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `attachment` anatomy, base-nova's own strings: the chip (`attachment`),
 * its media tile (`attachment-media`), the text column (`attachment-content`,
 * `attachment-title`, `attachment-description`) and the transparent link laid
 * over the whole chip (`attachment-trigger`). Size, orientation and state are
 * read from the root's `data-*` attributes, so one string per part serves
 * every combination. base-nova's `shimmer` on an unfinished title names no CSS
 * here and is left out.
 */
export type AttachmentSize = 'default' | 'sm' | 'xs'
export type AttachmentOrientation = 'horizontal' | 'vertical'

const ROOT =
  'group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed'

const SIZE = cva('', {
  variants: {
    size: {
      default:
        'gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2',
      sm: 'gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5',
      xs: 'gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1',
    },
  },
})

const ORIENTATION: Readonly<Record<AttachmentOrientation, string>> = {
  horizontal: 'min-w-40 items-center',
  vertical: 'w-24 flex-col has-data-[slot=attachment-content]:w-30',
}

/** `attachment`: the chip. */
export const computeAttachmentClasses = (
  size: AttachmentSize = 'default',
  orientation: AttachmentOrientation = 'horizontal'
): string => `${ROOT} ${SIZE({ size: size })} ${ORIENTATION[orientation]}`

const MEDIA_BASE =
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5"

const MEDIA_IMAGE =
  'opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover'

/** `attachment-media`: the icon or thumbnail tile. */
export const computeAttachmentMediaClasses = (variant: 'icon' | 'image' = 'icon'): string =>
  variant === 'image' ? `${MEDIA_BASE} ${MEDIA_IMAGE}` : MEDIA_BASE

/** `attachment-content`: the text column. */
export const computeAttachmentContentClasses = (): string =>
  'max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1'

/** `attachment-title`: the file name. */
export const computeAttachmentTitleClasses = (): string =>
  'block max-w-full min-w-0 truncate font-medium'

/** `attachment-description`: the line under the name. */
export const computeAttachmentDescriptionClasses = (): string =>
  'mt-0.5 block max-w-full min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80'

/** `attachment-trigger`: the transparent link over the whole chip. */
export const computeAttachmentTriggerClasses = (): string => 'absolute inset-0 z-10 outline-none'
