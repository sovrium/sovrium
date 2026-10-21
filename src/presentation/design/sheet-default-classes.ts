/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sheet (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The sheet anatomy, as base-nova draws it: one class string per `data-slot`.
 *
 * The content reads its edge off its own `data-side`, so one string serves the
 * four sides: it anchors to that edge, draws the one border facing the page
 * (`border-l` on a right sheet), and enters with a short 2.5rem slide plus a
 * fade. The width or height is the sheet's `drawerSize`, kept from the schema:
 * base-nova's own default (`w-3/4`, `sm:max-w-sm`) is replaced by it rather
 * than layered under it.
 *
 * Strings are base-nova's own, minus the `cn-*` style hooks the shadcn CLI
 * rewrites at install time.
 */

/** `sheet-content`, keyed on its own `data-side`. */
const SHEET_CONTENT = [
  'fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0',
  'data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]',
  'data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem]',
  'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem]',
  'data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]',
].join(' ')

/** `sheet-header`: the title and the description, with no divider under them. */
const SHEET_HEADER = 'flex flex-col gap-0.5 p-4'

const SHEET_TITLE = 'text-base font-medium text-foreground'

const SHEET_DESCRIPTION = 'text-sm text-muted-foreground'

/** Where the `sheet-close` button sits: one step further in than a dialog's. */
const SHEET_CLOSE_POSITION = 'top-3 right-3'

/** The sliding panel. */
export const computeSheetContentClasses = (): string => SHEET_CONTENT

/** The block holding the title and the description. */
export const computeSheetHeaderClasses = (): string => SHEET_HEADER

/** The sheet's heading. */
export const computeSheetTitleClasses = (): string => SHEET_TITLE

/** The supporting sentence under the title. */
export const computeSheetDescriptionClasses = (): string => SHEET_DESCRIPTION

/** The corner offset the close button takes inside a sheet. */
export const computeSheetClosePositionClasses = (): string => SHEET_CLOSE_POSITION

/** shadcn/ui `SheetFooter`: the actions, at the foot of the panel. */
export const computeSheetFooterClasses = (): string => 'mt-auto flex flex-col gap-2 p-4'
