/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui dialog and alert-dialog (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The dialog and alert-dialog anatomy, as base-nova draws it: one class string
 * per `data-slot`, read by the hydrated dialog island AND by the zero-JS dialog
 * the server draws (`hydrate: false`), which is why it lives here rather than
 * beside the island.
 *
 * Every string is base-nova's own, minus the `cn-*` style hooks the shadcn CLI
 * rewrites at install time (they name no CSS here). The surfaces bind shadcn's
 * variables through its utilities (`bg-popover`, `text-muted-foreground`,
 * `ring-foreground/10`), so an app's `design.colors.*` reaches them unchanged.
 *
 * The popup draws no border: base-nova outlines it with a 1px foreground ring at
 * 10 %. The only drawn line is the footer band's top divider, which takes the
 * border role.
 */

/** `dialog-overlay` / `alert-dialog-overlay`: the dimmer behind the popup. */
const OVERLAY =
  'fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0'

/** The enter / exit motion both popups share. */
const POPUP_MOTION =
  'duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/** `dialog-content`: centred, `sm:max-w-sm`, a 1px ring instead of a border. */
const DIALOG_CONTENT = `fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 sm:max-w-sm ${POPUP_MOTION}`

/**
 * `alert-dialog-content`, sized by its `data-size` (`default` today; `sm` is
 * the size the schema has not opened yet). The named group lets the header and
 * the footer read the size.
 */
const ALERT_DIALOG_CONTENT = `group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm ${POPUP_MOTION}`

const DIALOG_HEADER = 'flex flex-col gap-2'

const ALERT_DIALOG_HEADER =
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]'

/** `*-footer`: the action band, bled to the popup's edges, under a divider. */
const DIALOG_FOOTER =
  '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end'

const ALERT_DIALOG_FOOTER = `${DIALOG_FOOTER} group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2`

const DIALOG_TITLE = 'text-base leading-none font-medium'

const ALERT_DIALOG_TITLE = 'text-base font-medium'

const DIALOG_DESCRIPTION =
  'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground'

const ALERT_DIALOG_DESCRIPTION = `text-balance md:text-pretty ${DIALOG_DESCRIPTION}`

/**
 * `dialog-close`: the ghost icon button (`size: icon-sm`) in the popup's
 * top-right corner, carrying a 16px cross.
 */
const DIALOG_CLOSE =
  "absolute top-2 right-2 inline-flex size-7 shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-transparent bg-clip-padding outline-none select-none transition-all hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-muted/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** `alert-dialog-media`: the icon tile above (or beside) the title. */
export const computeAlertDialogMediaClasses = (): string =>
  "mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6"

/** Which of the two popups a slot belongs to. */
export type DialogKind = 'dialog' | 'alert-dialog'

/** The overlay behind either popup. */
export const computeDialogOverlayClasses = (): string => OVERLAY

/** The popup container of a dialog or an alert dialog. */
export const computeDialogContentClasses = (kind: DialogKind = 'dialog'): string =>
  kind === 'alert-dialog' ? ALERT_DIALOG_CONTENT : DIALOG_CONTENT

/**
 * The popup drawn on the platform's own modal `<dialog>`: the same box, its
 * dimmer the top layer's `::backdrop` rather than a sibling overlay.
 */
export const computeNativeDialogContentClasses = (): string =>
  `${DIALOG_CONTENT} backdrop:bg-black/10`

/** The block holding the title and the description. */
export const computeDialogHeaderClasses = (kind: DialogKind = 'dialog'): string =>
  kind === 'alert-dialog' ? ALERT_DIALOG_HEADER : DIALOG_HEADER

/** The action band at the bottom of the popup. */
export const computeDialogFooterClasses = (kind: DialogKind = 'dialog'): string =>
  kind === 'alert-dialog' ? ALERT_DIALOG_FOOTER : DIALOG_FOOTER

/** The heading that names the popup. */
export const computeDialogTitleClasses = (kind: DialogKind = 'dialog'): string =>
  kind === 'alert-dialog' ? ALERT_DIALOG_TITLE : DIALOG_TITLE

/** The supporting sentence under the title. */
export const computeDialogDescriptionClasses = (kind: DialogKind = 'dialog'): string =>
  kind === 'alert-dialog' ? ALERT_DIALOG_DESCRIPTION : DIALOG_DESCRIPTION

/** The corner close button. */
export const computeDialogCloseClasses = (): string => DIALOG_CLOSE

/**
 * The zero-JS dialog (`hydrate: false`) is the same anatomy laid out without a
 * script: its root is the full-screen centring layer the click enhancer shows
 * and hides, so the overlay sits inside it (`absolute`) and the content is a
 * flow box (`relative`) rather than a `fixed`, translated popup. No
 * `data-open` ever lands on it, so it carries no motion.
 */
const STATIC_DIALOG_OVERLAY =
  'absolute inset-0 bg-black/10 supports-backdrop-filter:backdrop-blur-xs'

const STATIC_DIALOG_CONTENT =
  'relative grid max-h-full w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm'

/** The overlay of the server-drawn dialog. */
export const computeStaticDialogOverlayClasses = (): string => STATIC_DIALOG_OVERLAY

/** The content box of the server-drawn dialog. */
export const computeStaticDialogContentClasses = (): string => STATIC_DIALOG_CONTENT

/**
 * `sheet-overlay`: the same tint, fading with the sheet on Base UI's
 * starting / ending styles rather than on keyframes. It lives beside the
 * dialog's because it is the same layer under another popup.
 */
const SHEET_OVERLAY =
  'fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs'

/** The overlay behind a sheet. */
export const computeSheetOverlayClasses = (): string => SHEET_OVERLAY
