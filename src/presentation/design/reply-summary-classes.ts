/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reply summary under a conversation turn — how many replies, the last
 * repliers' initials, when the last one came — read by the server render and by
 * the island that opens the thread from it, so the two draw one button.
 */

/** The summary button. */
export const computeReplySummaryClasses = (): string =>
  'inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none'

/** The stack of the last repliers' initials. */
export const computeReplySummaryAvatarsClasses = (): string => 'flex -space-x-1.5'

/** One replier's initials, a small disc. */
export const computeReplySummaryAvatarClasses = (): string =>
  'flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[0.625rem] font-medium text-muted-foreground'

/** When the last reply came. */
export const computeReplySummaryTimeClasses = (): string => 'font-normal text-muted-foreground'

/** The sheet the summary opens: the platform's modal `<dialog>`, on the inline end. */
export const computeReplySheetClasses = (): string =>
  'fixed inset-y-0 start-auto end-0 m-0 h-full max-h-none w-full max-w-md overflow-y-auto border-s border-border bg-popover p-0 text-sm text-popover-foreground shadow-lg outline-none backdrop:bg-black/10'

/** The sheet's header row: its title and its close button. */
export const computeReplySheetHeaderClasses = (): string =>
  'flex items-center justify-between gap-2 p-4'
