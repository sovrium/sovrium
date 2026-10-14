/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `message-scroller` frame: a box of the declared height whose content
 * scrolls inside it, the turns stacked with the thread's own gap. shadcn/ui's
 * Message Scroller ships its behaviour as an unstyled primitive and leaves the
 * frame to the author; this is the frame its examples draw.
 */
export const computeMessageScrollerClasses = (): string =>
  'flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4'
