/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { componentSlotsOf } from '@/domain/models/app/pages/components/component-types/component-type-union'
import {
  componentFields,
  entryAsComponent,
  rewriteComponent,
  type ComponentEntry,
  type ComponentNode,
} from '../resolve/component-rewrite'
import { extractFirstChildId, isLayoutWrapper } from './field-control-id'
import type { Component, ComponentType } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/**
 * Component SLOTS: the component arrays a type holds beside `children` — a
 * message's `header` and `footer`, a card's `footer` — and the one type pair
 * whose child is a single component field.
 *
 * ─── ONE PIPELINE ──────────────────────────────────────────────────────────
 *
 * A slot's components must reach the SAME pipeline a child does — variable
 * substitution, the `design.components` cascade, the recipe, the floor — or the
 * drawn thing would be a different element from the one the rest of the app
 * renders. Routing them through `children` is how they get all of that for
 * free: {@link childrenToRender} lays the slots and the children out as ONE
 * list in a fixed order, and the type's renderer cuts its `renderedChildren`
 * back into slots with {@link splitSlots}, counting each slot's declared length.
 *
 * `specimen` and `preview` are the substitution case: each draws the ONE
 * component in its `component` field, and declares no `children` of its own,
 * so that component replaces the (empty) children rather than joining them.
 */

/**
 * The order a type's slots and children are laid out in (`$children` marks the
 * children): the slots the schema declares for the type, then the children. The
 * order only has to be the same on both sides of the pipeline, and it is,
 * because both read it here.
 */
export const slotOrderOf = (type: string): readonly string[] | undefined => {
  const slots = componentSlotsOf(type)
  return slots.length === 0 ? undefined : [...slots, '$children']
}

/** A slot's components as a list: a list slot as written, a single slot as one or none. */
const slotComponents = (component: Component, slot: string): readonly ComponentEntry[] => {
  const value = componentFields(component)[slot]
  if (Array.isArray(value)) return value as readonly ComponentEntry[]
  return typeof value === 'object' && value !== null ? [value as ComponentEntry] : []
}

const slotLength = (component: Component, slot: string): number =>
  slotComponents(component, slot).length

/** A field is invalid while it carries one error or a non-empty error list. */
const isFieldInvalid = (source: Readonly<Record<string, unknown>>): boolean =>
  typeof source['fieldError'] === 'string' ||
  (Array.isArray(source['errors']) && source['errors'].length > 0)

/**
 * A field carrying an error marks its control invalid (`aria-invalid`), so a
 * screen reader announces the control as invalid and the control draws its
 * invalid ring; a field with a `fieldTitle` names its control by the title
 * (`aria-labelledby`), which reaches a control a `<label for>` cannot, such
 * as a switch, and a field with a `fieldLabel` names it by the label the same
 * way — a select's trigger is not the element its island host's id is on. The
 * control is the field's first child; it is given the id the label points at
 * when the author gave it none (`extractFirstChildId`).
 */
function withInvalidControl(
  component: Component,
  children: ReadonlyArray<ComponentEntry> | undefined
): ReadonlyArray<ComponentEntry> | undefined {
  const source = componentFields(component)
  const invalid = isFieldInvalid(source)
  const namedBy = namingPartOf(source)
  const [first, ...rest] = children ?? []
  if ((!invalid && namedBy === undefined) || typeof first !== 'object') return children
  const controlId = extractFirstChildId(component)
  const marks = {
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
    ...(controlId === undefined
      ? {}
      : {
          id: controlId,
          ...(namedBy === undefined ? {} : { 'aria-labelledby': `${controlId}-${namedBy}` }),
        }),
  }
  return [markControl(entryAsComponent(first), marks), ...rest]
}

/** Put the marks on the control, through any layout wrapper around it. */
function markControl(node: Component, marks: Readonly<Record<string, unknown>>): Component {
  if (!isLayoutWrapper(node)) return rewriteComponent(node, { props: { ...node.props, ...marks } })
  const [inner, ...siblings] = node.children ?? []
  return rewriteComponent(node, {
    children: [markControl(entryAsComponent(inner as ComponentNode), marks), ...siblings],
  })
}

/** The field part that names the control: its title beside a choice, else its label. */
const namingPartOf = (source: Readonly<Record<string, unknown>>): 'title' | 'label' | undefined => {
  if (typeof source['fieldTitle'] === 'string') return 'title'
  return typeof source['fieldLabel'] === 'string' ? 'label' : undefined
}

/** What a component's children are once its slots are laid out beside them. */
export function childrenToRender(
  type: ComponentType,
  component: Component,
  merged: ReadonlyArray<unknown> | undefined
): ReadonlyArray<ComponentEntry> | undefined {
  // The responsive merger hands back the children it was given, or a breakpoint's own list.
  const mergedChildren = merged as ReadonlyArray<ComponentEntry> | undefined
  if (type === 'specimen' || type === 'preview') {
    const drawn = componentFields(component)['component'] as Component | undefined
    return drawn === undefined ? mergedChildren : [drawn]
  }
  if (type === 'field') return withInvalidControl(component, mergedChildren)
  const order = slotOrderOf(type)
  if (order === undefined) return mergedChildren
  return order.flatMap((slot): ReadonlyArray<ComponentEntry> => {
    if (slot === '$children') return mergedChildren ?? []
    return slotComponents(component, slot)
  })
}

/**
 * Cut a type's rendered children back into its slots, by each slot's declared
 * length; the children take whatever the other slots leave.
 */
export function splitSlots(
  type: string,
  component: Component | undefined,
  rendered: readonly ReactElement[]
): Readonly<Record<string, readonly ReactElement[]>> {
  const order = slotOrderOf(type) ?? ['$children']
  const lengths = order.map((slot) =>
    slot === '$children' || component === undefined ? 0 : slotLength(component, slot)
  )
  const childrenLength = rendered.length - lengths.reduce((a, b) => a + b, 0)
  const sized = order.map((slot, index) =>
    slot === '$children' ? Math.max(childrenLength, 0) : (lengths[index] ?? 0)
  )
  return Object.fromEntries(
    order.map((slot, index) => {
      const start = sized.slice(0, index).reduce((a, b) => a + b, 0)
      return [slot, rendered.slice(start, start + (sized[index] ?? 0))]
    })
  )
}
