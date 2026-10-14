/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui drawer (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `drawer` anatomy as base-nova draws it over Base UI's Drawer: the overlay,
 * the popup (its height, snap offset and swipe movement read from the custom
 * properties Base UI writes), the handle, the header and the content. Only the
 * vertical axis is kept — a `drawer` rises from the bottom edge or drops from
 * the top one; a panel from a side edge is a `sheet`. Strings are base-nova's
 * own, minus the `cn-*` style hooks the shadcn CLI rewrites at install time,
 * with one change: base-nova draws a drawer with snap points full height and
 * slides it down by the snap offset, so the panel's box runs off the screen.
 * Here the panel is AS TALL as its current snap point (`--drawer-snap-height`,
 * set by the island), sits on its edge, and is not capped 6rem short of the
 * top, so a snap point of 1 is the full screen it promises.
 */

/** `drawer-overlay`: the dimmer behind a modal drawer, fading with the swipe. */
export const DRAWER_OVERLAY_CLASSES =
  'fixed inset-0 z-50 min-h-dvh bg-black/10 opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-snap-points:[--drawer-overlay-min-opacity:0.5] data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-xs supports-[-webkit-touch-callout:none]:absolute'

/** `drawer-viewport`: the fixed frame the popup is positioned in. */
export const DRAWER_VIEWPORT_CLASSES =
  'pointer-events-none fixed inset-0 z-50 select-none data-[modal=true]:pointer-events-auto'

/** `drawer-popup`: the panel. */
export const DRAWER_POPUP_CLASSES = [
  'group/drawer-popup pointer-events-auto fixed z-50 m-(--drawer-inset,0px) flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col bg-popover text-sm text-popover-foreground transition-[transform,height,opacity,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform outline-none select-none [interpolate-size:allow-keywords] data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=down]:border-t data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=up]:border-b',
  'data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95',
  'after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=up]:after:bottom-full',
  '[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:var(--drawer-snap-height,100dvh)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-max-height:none]',
  '[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]',
  'data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
  'data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)',
  'data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]',
  'data-snap-points:data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))] data-snap-points:data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
  'data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
].join(' ')

/** `drawer-handle`: the grip a reader drags the panel by. */
export const DRAWER_HANDLE_CLASSES =
  'relative z-10 flex h-3 w-full shrink-0 cursor-grab justify-center transition-opacity duration-200 group-data-[swipe-direction=down]/drawer-popup:items-end group-data-[swipe-direction=up]/drawer-popup:order-last group-data-[swipe-direction=up]/drawer-popup:items-start after:block after:h-1 after:w-24 after:shrink-0 after:rounded-full after:bg-muted active:cursor-grabbing'

/** `drawer-content`: the scrolling body below the handle. */
export const DRAWER_CONTENT_CLASSES =
  'flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none'

/** `drawer-header`: the title and the description. */
export const DRAWER_HEADER_CLASSES =
  'flex shrink-0 flex-col gap-0.5 p-4 pb-0 group-data-[swipe-axis=y]/drawer-popup:text-center md:gap-0.5 md:text-left'

/** `drawer-title`. */
export const DRAWER_TITLE_CLASSES = 'text-base font-medium text-foreground'

/** `drawer-description`. */
export const DRAWER_DESCRIPTION_CLASSES = 'text-sm text-balance text-muted-foreground'

/** The body the authored children are injected into. */
export const DRAWER_BODY_CLASSES = 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4'
