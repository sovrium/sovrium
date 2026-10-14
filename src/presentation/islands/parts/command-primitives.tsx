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
 * The command menu every Sovrium palette draws through: shadcn's `command`
 * anatomy over cmdk ([internal ref] D3). {@link CommandDialog} is the overlay, a Base
 * UI dialog; {@link Command} inside it owns the filtering and the keyboard
 * (arrows move the highlighted item, Enter selects it), and the input is the
 * `combobox` that drives the list.
 *
 * Departures from the upstream file:
 *
 *  - {@link CommandDialog} is Sovrium's Base UI dialog shell, never cmdk's own
 *    `Command.Dialog`: cmdk brings a Radix dialog stack transitively, and two
 *    dialog stacks on one page would disagree about focus and dismissal. The
 *    Radix one is therefore never mounted.
 *  - No `cn`: class lists are joined, so a `className` adds to the slot's
 *    classes rather than merging over them.
 *  - The input's wrapper carries the input group's classes directly, without
 *    the group roles, so a palette has exactly the groups its items form.
 *  - The search and check icons are inline SVG (lucide's paths).
 */

import { Dialog } from '@base-ui/react/dialog'
import { Command as CommandPrimitive } from 'cmdk'
import {
  COMMAND_DIALOG_CLASSES,
  COMMAND_EMPTY_CLASSES,
  COMMAND_GROUP_CLASSES,
  COMMAND_INPUT_ADDON_CLASSES,
  COMMAND_INPUT_CLASSES,
  COMMAND_INPUT_GROUP_CLASSES,
  COMMAND_INPUT_WRAPPER_CLASSES,
  COMMAND_ITEM_CLASSES,
  COMMAND_LIST_CLASSES,
  COMMAND_ROOT_CLASSES,
  COMMAND_SEPARATOR_CLASSES,
  COMMAND_SHORTCUT_CLASSES,
} from '@/presentation/design/command-default-classes'
import { computeDialogOverlayClasses } from '@/presentation/design/dialog-default-classes'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

const join = (...classes: ReadonlyArray<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')

/** The menu: cmdk's root, which filters its items and owns the arrow keys. */
export function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>): ReactElement {
  return (
    <CommandPrimitive
      data-slot="command"
      className={join(COMMAND_ROOT_CLASSES, className)}
      {...props}
    />
  )
}

/**
 * The palette overlay: a Base UI dialog named `title` by its `aria-label`.
 * Upstream names it with an off-screen heading; a label is the same name with
 * one source, and the console's palette has always announced exactly one.
 * Escape and a press on the backdrop close it through `onOpenChange`.
 */
export function CommandDialog({
  open,
  onOpenChange,
  title,
  className,
  children,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly className?: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="dialog-overlay"
          className={computeDialogOverlayClasses()}
        />
        <Dialog.Popup
          data-slot="dialog-content"
          aria-label={title}
          className={join(COMMAND_DIALOG_CLASSES, className)}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The search field: cmdk's input, which is the `combobox` the list answers to. */
export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>): ReactElement {
  return (
    <div
      data-slot="command-input-wrapper"
      className={COMMAND_INPUT_WRAPPER_CLASSES}
    >
      <div
        data-slot="input-group"
        className={COMMAND_INPUT_GROUP_CLASSES}
      >
        <span
          data-slot="input-group-addon"
          className={COMMAND_INPUT_ADDON_CLASSES}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4 shrink-0 opacity-50"
          >
            <path d="m21 21-4.34-4.34" />
            <circle
              cx="11"
              cy="11"
              r="8"
            />
          </svg>
        </span>
        <CommandPrimitive.Input
          data-slot="command-input"
          className={join(COMMAND_INPUT_CLASSES, className)}
          {...props}
        />
      </div>
    </div>
  )
}

/** The scrolling list of groups and items. */
export function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>): ReactElement {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={join(COMMAND_LIST_CLASSES, className)}
      {...props}
    />
  )
}

/** What the list shows when no item matches.
 * @public The shadcn anatomy is ported whole; the authored `command` groups use it.
 */
export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>): ReactElement {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={join(COMMAND_EMPTY_CLASSES, className)}
      {...props}
    />
  )
}

/** A named group of items: its `heading` names the `group` its items form. */
export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>): ReactElement {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={join(COMMAND_GROUP_CLASSES, className)}
      {...props}
    />
  )
}

/** A rule between groups.
 * @public The shadcn anatomy is ported whole; the authored `command` groups use it.
 */
export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>): ReactElement {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={join(COMMAND_SEPARATOR_CLASSES, className)}
      {...props}
    />
  )
}

/** One item: an `option`, highlighted by the arrows and chosen by Enter or a press. */
export function CommandItem({
  className,
  children,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>): ReactElement {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={join(COMMAND_ITEM_CLASSES, className)}
      {...props}
    >
      {children}
    </CommandPrimitive.Item>
  )
}

/** The keys that run an item, drawn after its label.
 * @public The shadcn anatomy is ported whole; the authored `command` groups use it.
 */
export function CommandShortcut({ className, ...props }: ComponentProps<'span'>): ReactElement {
  return (
    <span
      data-slot="command-shortcut"
      className={join(COMMAND_SHORTCUT_CLASSES, className)}
      {...props}
    />
  )
}
