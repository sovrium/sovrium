/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The panels every overlay is drawn as, and the one reason they are all drawn
// this way.
//
// ─── AN OVERLAY HAS NO RESTING APPEARANCE, SO THE CONSOLE DRAWS ITS PANEL ──
//
// Five of these types the catalogue refuses to preview outright — a dialog makes
// the rest of the document inert, a sheet covers the page, an alert dialog
// holds focus until it is answered. The other four DO render, and render a
// TRIGGER: the popup exists only while a pointer is on it, which a static
// document cannot hold.
//
// So every overlay here is drawn as its popup, at rest, in the frame it would
// appear in. That is a composition and not the component, and saying so is the
// point: this page documents what the surface LOOKS like, and a page that drew
// the trigger instead would document a button.
//
// ─── THE DRAWING TAKES SHADCN'S ANATOMY, SLOT BY SLOT ──────────────────────
//
// Each helper below draws one shadcn part with the classes base-nova gives it
// and tags it with that part's `data-slot`, so the drawing and the live
// component read the same in an inspector: a popup outlined by a faint ring
// rather than a border, on the `popover` colour; a dialog whose buttons sit in
// a muted band under a divider; a sheet drawing only the edge that faces the
// page; a popover and a hover card with no arrow. The live classes live in the
// recipes beside each island; these copy them, and a drift between the two is
// a defect in the drawing.
//
// Nothing here is interactive. A real overlay on a documentation page would put
// a focus trap and a scroll lock into a surface a reader is trying to read.

import type { PageComponent } from './body-shape'

/** A `div` with classes, an optional `data-slot`, and children. */
export const box = (
  className: string,
  children: readonly PageComponent[],
  slot?: string
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className, ...(slot === undefined ? {} : { 'data-slot': slot }) },
    children: [...children],
  }) as PageComponent

/** A line of text, optionally tagged with its slot. */
export const line = (
  content: string,
  className: string,
  slot?: string,
  element: 'p' | 'span' = 'p'
): PageComponent =>
  ({
    type: 'text',
    element,
    props: { className, ...(slot === undefined ? {} : { 'data-slot': slot }) },
    content,
  }) as PageComponent

/**
 * The plain floating surface the pickers and the navigation menu still draw.
 * The overlays of this family use the slot-tagged helpers below instead.
 */
export const panel = (input: {
  readonly width?: string
  readonly children: readonly PageComponent[]
}): PageComponent =>
  box(
    `border-border bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-md ${input.width ?? 'w-80'}`,
    input.children
  )

/** A footer button, as `dialog-close` or the confirm renders it. */
const action = (label: string, variant: 'outline' | 'default' | 'destructive'): PageComponent =>
  ({ type: 'button', variant, label, props: { type: 'button' } }) as PageComponent

/** What a dialog or an alert dialog holds. */
interface DialogDrawing {
  readonly kind: 'dialog' | 'alert-dialog'
  readonly title: string
  readonly description?: string
  readonly body?: readonly PageComponent[]
  readonly cancel?: string
  readonly confirm?: string
  readonly destructive?: boolean
}

/** The ghost icon button in a dialog's or a sheet's top-right corner. */
export const closeButton = (kind: 'dialog' | 'sheet', position: string): PageComponent =>
  box(
    `text-foreground absolute ${position} inline-flex size-7 items-center justify-center rounded-md`,
    [{ type: 'icon', props: { name: 'x', size: 16 } } as PageComponent],
    `${kind}-close`
  )

/** The `*-header` slot: the title and the sentence under it. */
const dialogHeader = (input: DialogDrawing): PageComponent =>
  box(
    input.kind === 'alert-dialog' ? 'grid gap-1.5 text-left' : 'flex flex-col gap-2',
    [
      line(
        input.title,
        input.kind === 'alert-dialog'
          ? 'text-foreground text-base font-medium'
          : 'text-foreground text-base leading-none font-medium',
        `${input.kind}-title`
      ),
      ...(input.description === undefined
        ? []
        : [line(input.description, 'text-muted-foreground text-sm', `${input.kind}-description`)]),
    ],
    `${input.kind}-header`
  )

/** The `*-footer` slot: the action band, bled to the popup's edges. */
const dialogFooter = (input: DialogDrawing): readonly PageComponent[] =>
  input.confirm === undefined
    ? []
    : [
        box(
          '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
          [
            ...(input.cancel === undefined ? [] : [action(input.cancel, 'outline')]),
            action(input.confirm, input.destructive === true ? 'destructive' : 'default'),
          ],
          `${input.kind}-footer`
        ),
      ]

/** A dialog or an alert dialog's `*-content`, at base-nova's `sm:max-w-sm`. */
export const dialogPanel = (input: DialogDrawing): PageComponent =>
  box(
    'bg-popover text-popover-foreground ring-foreground/10 relative grid w-full max-w-sm gap-4 rounded-xl p-4 text-sm ring-1',
    [
      dialogHeader(input),
      ...(input.body ?? []),
      ...dialogFooter(input),
      ...(input.kind === 'dialog' ? [closeButton('dialog', 'top-2 right-2')] : []),
    ],
    `${input.kind}-content`
  )

/**
 * The page a dialog sits over: a ground, dimmed by the `*-overlay` tint the
 * live backdrop paints, with the popup centred on it.
 */
export const overPage = (kind: 'dialog' | 'alert-dialog', popup: PageComponent): PageComponent =>
  box('bg-background relative flex w-full items-center justify-center rounded-lg border p-8', [
    box('absolute inset-0 rounded-lg bg-black/10', [], `${kind}-overlay`),
    popup,
  ])

/** A popover's or a hover card's `*-content`: a ringed card, no arrow. */
export const floatingPanel = (
  kind: 'popover' | 'hover-card',
  children: readonly PageComponent[]
): PageComponent =>
  box(
    kind === 'popover'
      ? 'bg-popover text-popover-foreground ring-foreground/10 flex w-72 flex-col gap-2.5 rounded-lg p-2.5 text-sm shadow-md ring-1'
      : 'bg-popover text-popover-foreground ring-foreground/10 w-64 rounded-lg p-2.5 text-sm shadow-md ring-1',
    children,
    `${kind}-content`
  )
