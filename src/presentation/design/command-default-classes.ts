/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui command (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The command menu's slot classes, base-nova's, read by both sides of it: the
 * cmdk island's parts (`islands/parts/command-primitives.tsx`) and the
 * server-drawn specimen of the palette (`render/registry/command-palette-component.tsx`),
 * so a specimen wears exactly the classes the live menu does.
 */

/** `command`: the menu's box. */
export const COMMAND_ROOT_CLASSES =
  'flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground'

/** The palette's dialog popup, upstream's `CommandDialog` content over Base UI. */
export const COMMAND_DIALOG_CLASSES = [
  'fixed top-1/3 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2',
  'overflow-hidden rounded-xl bg-popover p-0 text-sm text-popover-foreground',
  'ring-1 ring-foreground/10 outline-none sm:max-w-lg',
  'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
  'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
].join(' ')

/** `command-input-wrapper`. */
export const COMMAND_INPUT_WRAPPER_CLASSES = 'p-1 pb-0'

/** The input group around the field, without its group roles. */
export const COMMAND_INPUT_GROUP_CLASSES =
  'relative flex h-8 w-full min-w-0 items-center rounded-lg border border-input/30 bg-input/30 transition-colors outline-none dark:bg-input/30'

/** The search icon's addon. */
export const COMMAND_INPUT_ADDON_CLASSES =
  'order-first flex items-center pl-2 text-muted-foreground'

/** `command-input`. */
export const COMMAND_INPUT_CLASSES =
  'w-full bg-transparent px-2 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50'

/** `command-list`. */
export const COMMAND_LIST_CLASSES =
  'no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none'

/** `command-empty`. */
export const COMMAND_EMPTY_CLASSES = 'py-6 text-center text-sm'

/** `command-group`, its heading styled through cmdk's own attribute. */
export const COMMAND_GROUP_CLASSES = [
  'overflow-hidden p-1 text-foreground',
  '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs',
  '**:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground',
].join(' ')

/** `command-separator`. */
export const COMMAND_SEPARATOR_CLASSES = '-mx-1 h-px bg-border'

/** `command-item`. */
export const COMMAND_ITEM_CLASSES = [
  'group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
  'outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg',
  'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
  'data-selected:bg-muted data-selected:text-foreground',
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  'data-selected:*:[svg]:text-foreground',
].join(' ')

/** `command-shortcut`. */
export const COMMAND_SHORTCUT_CLASSES =
  'ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground'
