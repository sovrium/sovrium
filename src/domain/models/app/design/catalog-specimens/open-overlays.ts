/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four overlays a still document draws OPEN: `sheet`, `dialog`,
 * `alert-dialog` and `drawer`.
 *
 * The catalogue the console draws keeps refusing them (`interaction.ts`): drawn
 * live there they would portal over the console page and, modal, make it inert.
 * A component kit page is a still document nobody operates, so it draws each
 * one open inside a bounded frame instead — `props.specimenOpen`, the flag every
 * open specimen is drawn by, read by the renderer and never by an author.
 *
 * Each carries the words a console overlay carries, so the kit shows the panel
 * a row click opens and the question a delete asks rather than an empty box.
 */

import { SPECIMEN_BY_TYPE, type CatalogSpecimen } from './catalog-specimens'
import type { Component } from '@/domain/models/app/pages/components'

const component = (value: unknown): Component => value as Component

/** The words of an overlay's body, drawn as the overlay's own child. */
const bodyText = (content: string): unknown => ({
  type: 'text',
  element: 'p',
  props: { className: 'text-sm text-muted-foreground' },
  content,
})

export const OPEN_OVERLAY_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'sheet',
    component: component({
      type: 'sheet',
      props: { specimenOpen: true, title: 'Run 4218' },
      description: 'Started today at 14:54 by the nightly sync.',
      children: [bodyText('42 records read, 3 updated, no error.')],
    }),
  },
  {
    type: 'dialog',
    component: component({
      type: 'dialog',
      props: { specimenOpen: true, title: 'Rename view' },
      description: 'The new name shows in the view switcher for everyone.',
      children: [bodyText('Open invoices, by client')],
    }),
  },
  {
    type: 'alert-dialog',
    component: component({
      type: 'alert-dialog',
      props: { specimenOpen: true, title: 'Delete 3 records?', variant: 'destructive' },
      content: 'This removes them for every reader and cannot be undone.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
    }),
  },
  {
    type: 'drawer',
    component: component({
      type: 'drawer',
      props: { specimenOpen: true },
      title: 'Filters',
      description: 'Narrow the list to what you need today.',
      children: [bodyText('Status is Sent, client is Cabinet Morel.')],
    }),
  },
]

/** The open specimen of an overlay, by type. */
export const OPEN_OVERLAY_SPECIMEN_BY_TYPE: ReadonlyMap<string, Component> = new Map(
  OPEN_OVERLAY_SPECIMENS.flatMap((specimen) =>
    specimen.component === undefined ? [] : [[specimen.type, specimen.component] as const]
  )
)

/**
 * What a component kit page draws for one type: the overlay drawn open where
 * the type is one of the four, else the catalogue's own specimen. `undefined`
 * when the kit has nothing to draw. The one answer the kit and a page sweep
 * over the kit's types both read, so a type the kit draws is never a page
 * nobody can declare.
 */
export const kitSpecimenComponent = (type: string): Component | undefined =>
  OPEN_OVERLAY_SPECIMEN_BY_TYPE.get(type) ?? SPECIMEN_BY_TYPE.get(type)?.component
