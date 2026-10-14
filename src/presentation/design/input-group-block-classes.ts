/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input-group (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The input group in its column form, for a control it does not own: the
 * comment composer's textarea and the rich-text and code editors.
 *
 * - The frame is the group's root, unchanged: its ring follows the control
 *   alone, through the root's `input-group-control` rule, so the island stamps
 *   that slot on the element that takes the text (the textarea, the
 *   contenteditable, CodeMirror's content). A button in an addon taking focus
 *   leaves the frame unringed, as shadcn/ui draws it.
 * - A `block-start` or `block-end` addon is shadcn/ui's
 *   `inputGroupAddonVariants` at those alignments; the inline ones stay in
 *   `input-group-default-classes.ts`, which only the `input-group` type and
 *   the tree draw.
 */

import { computeInputGroupClasses } from './input-group-root-classes'

/** The group framing a control it does not own; the ring follows that control's focus. */
export const computeInputGroupFrameClasses = (): string => computeInputGroupClasses()

const BLOCK_ALIGN = {
  'block-start':
    'order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2',
  'block-end':
    'order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2',
} as const

/** shadcn/ui `InputGroupAddon` above (`block-start`) or below (`block-end`) the control. */
export const computeInputGroupBlockAddonClasses = ({
  align,
}: {
  readonly align: keyof typeof BLOCK_ALIGN
}): string =>
  `flex h-auto cursor-text items-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4 ${BLOCK_ALIGN[align]}`
