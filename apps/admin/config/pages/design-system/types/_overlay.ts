/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The panel every overlay is drawn as, and the one reason they are all drawn
// this way.
//
// ─── AN OVERLAY HAS NO RESTING APPEARANCE, SO THE CONSOLE DRAWS ITS PANEL ──
//
// Five of these types the catalogue refuses to preview outright — a dialog makes
// the rest of the document inert, a drawer covers the page, an alert dialog
// holds focus until it is answered. The other four DO render, and render a
// TRIGGER: the popup exists only while a pointer is on it, which a static
// document cannot hold.
//
// So every overlay here is drawn as its popup, at rest, in the frame it would
// appear in. That is a composition and not the component, and saying so is the
// point: this page documents what the surface LOOKS like, and a page that drew
// the trigger instead would document a button.
//
// Nothing here is interactive. A real overlay on a documentation page would put
// a focus trap and a scroll lock into a surface a reader is trying to read.

import type { PageComponent } from './_shape'

/** The floating surface an overlay's content sits on. */
export const panel = (input: {
  readonly width?: string
  readonly children: readonly PageComponent[]
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-4 shadow-md ${input.width ?? 'w-80'}`,
    },
    children: [...input.children],
  }) as PageComponent

/** A title and a line under it, the head every overlay panel opens with. */
export const panelHead = (title: string, body?: string): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground text-md font-medium' },
    content: title,
  } as PageComponent,
  ...(body === undefined
    ? []
    : [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground-subtle text-sm leading-relaxed' },
          content: body,
        } as PageComponent,
      ]),
]

/** The action row an overlay closes with. */
export const panelActions = (cancel: string, confirm: string, destructive = false): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex justify-end gap-2 pt-1' },
    children: [
      { type: 'button', variant: 'outline', size: 'sm', label: cancel, props: { type: 'button' } },
      {
        type: 'button',
        variant: destructive ? 'destructive' : 'default',
        size: 'sm',
        label: confirm,
        props: { type: 'button' },
      },
    ],
  }) as PageComponent

/** The dimmed page an overlay sits over, where the drawing needs the context. */
export const overPage = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-subtle relative flex w-full items-center justify-center rounded-lg border p-8',
    },
    children: [...children],
  }) as PageComponent
