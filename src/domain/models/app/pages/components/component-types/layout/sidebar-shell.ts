/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sidebar's SHELL: how shadcn/ui's Sidebar folds, which side it stands
 * on, how it is framed, and the controls that fold it — plus the small action
 * a group heading or an entry row carries.
 *
 * Kept beside `sidebar.ts` rather than inside it: that file holds the
 * navigation's entries and groups, and this one holds the box around them.
 */

import { Schema } from 'effect'

/** A small icon control beside a group heading or an entry: shadcn/ui's SidebarGroupAction / SidebarMenuAction. */
export const SidebarActionSchema = Schema.Struct({
  icon: Schema.String.pipe(
    Schema.annotate({ description: 'Lucide icon drawn as the control', examples: ['plus'] }),
    Schema.check(Schema.isMinLength(1))
  ),
  label: Schema.String.pipe(
    Schema.annotate({
      description: "The control's accessible name; accepts a $t: key",
      examples: ['New project'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  href: Schema.String.pipe(
    Schema.annotate({ description: 'Where the control goes', examples: ['/projects/new'] }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'SidebarAction',
  title: 'Sidebar Action',
  description: 'A named icon control that goes where it says, beside a group heading or an entry',
})

/** @public */
export type SidebarAction = Schema.Schema.Type<typeof SidebarActionSchema>

/** What a disclosure's fetched list shows while it loads. */
export const SidebarSourceLoadingSchema = Schema.Literals(['label', 'skeleton']).annotate({
  description:
    "What the list shows while it loads: 'label' (the default) its loadingLabel line, or 'skeleton' placeholder rows (shadcn/ui's SidebarMenuSkeleton)",
})

/** The control that folds the sidebar: shadcn/ui's SidebarTrigger. */
const SidebarTriggerSchema = Schema.Struct({
  label: Schema.String.pipe(
    Schema.annotate({
      description: "The trigger's accessible name; accepts a $t: key",
      examples: ['Toggle navigation'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  shortcut: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether Control or Command with B also folds the sidebar (default: true)',
    })
  ),
}).annotate({
  identifier: 'SidebarTrigger',
  title: 'Sidebar Trigger',
  description: 'The button that folds and unfolds a collapsible sidebar, and its keyboard shortcut',
})

export const sidebarShellFields = {
  collapsible: Schema.optional(
    Schema.Literals(['none', 'icon', 'offcanvas']).annotate({
      description:
        "How the sidebar folds: 'none' (the default) never folds; 'icon' folds it to a strip of its entries' icons; 'offcanvas' moves it off the page and gives its width to the content beside it. shadcn/ui's Sidebar collapsible.",
    })
  ),
  trigger: Schema.optional(
    SidebarTriggerSchema.annotate({
      description:
        'The button that folds a collapsible sidebar; drawn only when collapsible is icon or offcanvas',
    })
  ),
  side: Schema.optional(
    Schema.Literals(['left', 'right']).annotate({
      description:
        "Which edge the sidebar stands against: 'left' (the default) or 'right', after the content beside it",
    })
  ),
  variant: Schema.optional(
    Schema.Literals(['sidebar', 'floating', 'inset']).annotate({
      description:
        "The sidebar's frame: 'sidebar' (the default) against the page edge, 'floating' as a rounded panel standing off it, or 'inset'. shadcn/ui's Sidebar variant.",
    })
  ),
  railHandle: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Draw a thin rail along the sidebar's inner edge that folds and unfolds it when pressed (default: false). shadcn/ui's SidebarRail.",
    })
  ),
  persist: Schema.optional(
    Schema.Literals(['cookie', 'none']).annotate({
      description:
        "Whether a fold survives a reload: 'cookie' (the default) remembers it in the sidebar_state cookie the server reads, so the page is served folded; 'none' forgets it",
    })
  ),
} as const
