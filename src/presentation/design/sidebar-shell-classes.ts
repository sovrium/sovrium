/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The sidebar's shell parts on shadcn/ui's Sidebar anatomy: the box's width as
 * it folds, the drawn panel (`data-sidebar="sidebar"`), the header and the
 * footer around the groups, the trigger and the rail that fold it, the small
 * actions beside a heading or an entry, and the skeleton of a loading list.
 *
 * The box carries shadcn's `data-state`, `data-collapsible` (set while folded),
 * `data-variant` and `data-side`, and is `group/sidebar`, so every part reads
 * them. Unlike shadcn's fixed container, the box stays in the page's flow: its
 * parent is laid out as a row (`sidebar-shell-styles.ts`).
 */

/** The width a shell sidebar takes, expanded, folded to icons, or off the page. */
export const computeSidebarShellBoxClasses = (): string =>
  'group/sidebar relative shrink-0 [--sidebar-width:16rem] [--sidebar-width-icon:3rem] w-(--sidebar-width) transition-[width] duration-200 ease-linear data-[collapsible=icon]:w-(--sidebar-width-icon) data-[collapsible=icon]:data-[variant=floating]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)] data-[collapsible=icon]:data-[variant=inset]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))] data-[collapsible=offcanvas]:w-0 data-[side=right]:order-last data-[variant=floating]:bg-transparent data-[variant=floating]:p-2 data-[variant=inset]:bg-transparent data-[variant=inset]:p-2'

/**
 * The drawn panel: shadcn/ui's inner `data-sidebar="sidebar"` surface. It fills
 * the box only on a shell sidebar: an ordinary sidebar's box sets its own height
 * and scrolls, and a full-height flex column inside it would shrink its groups
 * until they overlapped.
 */
export const computeSidebarSurfaceClasses = (): string =>
  'flex w-full min-w-0 flex-col group-data-[sidebar-shell]/sidebar:h-full group-data-[collapsible]/sidebar:overflow-hidden group-data-[variant=floating]/sidebar:rounded-lg group-data-[variant=floating]/sidebar:border group-data-[variant=floating]/sidebar:border-sidebar-border group-data-[variant=floating]/sidebar:bg-sidebar group-data-[variant=floating]/sidebar:shadow-sm group-data-[variant=inset]/sidebar:bg-sidebar'

/** shadcn/ui `SidebarHeader`. */
export const computeSidebarHeaderClasses = (): string => 'flex flex-col gap-2 p-2'

/** shadcn/ui `SidebarFooter`, pushed to the foot of the panel. */
export const computeSidebarFooterClasses = (): string => 'mt-auto flex flex-col gap-2 p-2'

/** shadcn/ui `SidebarTrigger`, standing just outside the sidebar's inner edge so a folded sidebar can be unfolded. */
export const computeSidebarTriggerClasses = (): string =>
  'absolute top-2 z-20 inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[side=left]/sidebar:left-full group-data-[side=left]/sidebar:ml-2 group-data-[side=right]/sidebar:right-full group-data-[side=right]/sidebar:mr-2 [&>svg]:size-4'

/** shadcn/ui `SidebarRail`: a thin handle centred on the sidebar's inner edge. */
export const computeSidebarRailHandleClasses = (): string =>
  'absolute inset-y-0 z-20 w-4 cursor-ew-resize transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]/sidebar:right-0 group-data-[side=left]/sidebar:translate-x-1/2 group-data-[side=right]/sidebar:left-0 group-data-[side=right]/sidebar:-translate-x-1/2'

/** shadcn/ui `SidebarGroupAction`: a small icon control at the end of the heading row. */
export const computeSidebarGroupActionClasses = (): string =>
  'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:hidden [&>svg]:size-4 [&>svg]:shrink-0'

/** shadcn/ui `SidebarMenuAction`: a small icon control at the end of an entry's row. */
export const computeSidebarMenuActionClasses = (): string =>
  'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:hidden [&>svg]:size-4 [&>svg]:shrink-0'

/** shadcn/ui `SidebarMenuSkeleton`: one placeholder row of a loading list. */
export const computeSidebarMenuSkeletonClasses = (): string =>
  'flex h-8 items-center gap-2 rounded-md px-2'

/** The placeholder text bar inside a skeleton row. */
export const computeSidebarMenuSkeletonTextClasses = (): string =>
  'h-4 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-accent'

/**
 * A shell sidebar that folds into a drawer on a phone: below the drawer's
 * breakpoint the box leaves the flow and spans the top edge at no height, so
 * the inset starts at the top of the page and the drawer's menu button can sit
 * where the fold trigger sits on a wider screen, at the start of the inset's
 * header. Spelled literally per breakpoint: the CSS compiler harvests its
 * candidates from the source text.
 */
const SHELL_DRAWER_BOX_CLASSES = {
  sm: 'max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:h-0 max-sm:w-auto! max-sm:p-0!',
  md: 'max-md:absolute max-md:inset-x-0 max-md:top-0 max-md:h-0 max-md:w-auto! max-md:p-0!',
  lg: 'max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:h-0 max-lg:w-auto! max-lg:p-0!',
  xl: 'max-xl:absolute max-xl:inset-x-0 max-xl:top-0 max-xl:h-0 max-xl:w-auto! max-xl:p-0!',
  '2xl':
    'max-2xl:absolute max-2xl:inset-x-0 max-2xl:top-0 max-2xl:h-0 max-2xl:w-auto! max-2xl:p-0!',
} as const

/** The controls that fold the sidebar, which a phone does not draw: the drawer replaces them. */
const FOLD_CONTROL_HIDDEN_BELOW = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
  xl: 'max-xl:hidden',
  '2xl': 'max-2xl:hidden',
} as const

export type SidebarShellDrawerBreakpoint = keyof typeof SHELL_DRAWER_BOX_CLASSES

/** The box of a shell sidebar below its drawer's breakpoint. */
export const computeSidebarShellDrawerBoxClasses = (below: SidebarShellDrawerBreakpoint): string =>
  SHELL_DRAWER_BOX_CLASSES[below]

/** The fold trigger and rail of a sidebar that folds into a drawer: gone below the breakpoint. */
export const computeSidebarFoldControlDrawerClasses = (
  below: SidebarShellDrawerBreakpoint
): string => FOLD_CONTROL_HIDDEN_BELOW[below]

/**
 * The drawer's menu button on a shell sidebar: shadcn/ui's `SidebarTrigger`
 * opening the sheet on a phone, an icon button at the start of the inset's
 * header. Its label stays in the document as the button's name.
 */
export const computeSidebarShellDrawerTriggerClasses = (): string =>
  'absolute top-2 z-20 size-7 gap-0 self-auto rounded-md px-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[side=left]/sidebar:left-2 group-data-[side=right]/sidebar:right-2 [&>span]:sr-only'
