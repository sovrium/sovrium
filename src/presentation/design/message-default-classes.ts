/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui message (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `message` anatomy, base-nova's own strings, with one change: shadcn's
 * `Message` is `w-full`, a row whose end side is drawn by reversing it; here a
 * turn is as wide as what it holds, and an `end` turn is pushed to the inline
 * end of the thread (`ms-auto`), so the side a turn sits on is a measurable
 * place in the column and still mirrors on a right-to-left page.
 */

/** `message`: the turn. */
export const computeMessageClasses = (): string =>
  'group/message relative flex w-fit max-w-[85%] min-w-0 gap-2 text-sm data-[align=end]:ms-auto data-[align=end]:flex-row-reverse'

/** `message-avatar`: the picture beside the turn. */
export const computeMessageAvatarClasses = (): string =>
  'flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full'

/** `message-content`: the column holding the header, the surface and the footer. */
export const computeMessageContentClasses = (): string =>
  'flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:items-end'

/** `message-header`: the line above the surface (the author, the time, a header slot). */
export const computeMessageHeaderClasses = (): string =>
  'flex max-w-full min-w-0 items-center gap-2 px-3 text-xs font-medium text-muted-foreground'

/** `message-footer`: the line below the surface. */
export const computeMessageFooterClasses = (): string =>
  'flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-data-[align=end]/message:justify-end'
