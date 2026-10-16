/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * How a `field` reaches its control — the first child, looked up through
 * layout wrappers — and the id its label points at (WCAG 1.3.1, RGAA 11.1).
 *
 * A labelled field whose control has no id is given one, ONCE, on the control
 * in the component tree ({@link withFieldControlId}), before either the field's
 * label or the control is drawn: both then read the same id. The id is built
 * from the render's own unique id, so two fields with the same label on one
 * page never share it (RGAA 8.2), and from the control's name or the label as a
 * readable tail, accents folded (`Prénom` → `prenom`), never empty.
 */

/**
 * The layout types a field's control may sit inside — a design-kit specimen
 * wraps its select in a `container` — and that never ARE the control.
 */
const LAYOUT_WRAPPERS: ReadonlySet<string> = new Set(['container', 'flex', 'stack', 'grid', 'div'])

type Node = Readonly<Record<string, unknown>>

/** The node's first child, when it is a component rather than text. */
const firstComponentChild = (node: Node): Node | undefined => {
  const { children } = node
  const first: unknown = Array.isArray(children) ? children[0] : undefined
  return typeof first === 'object' && first !== null ? (first as Node) : undefined
}

/** Whether a node only lays its one child out, so the field's control is inside it. */
export const isLayoutWrapper = (node: object): boolean => {
  const record = node as Node
  return (
    typeof record['type'] === 'string' &&
    LAYOUT_WRAPPERS.has(record['type']) &&
    firstComponentChild(record) !== undefined
  )
}

/** The field's control: its first child, looking through layout wrappers to the control inside. */
function fieldControlOf(field: Node): Node | undefined {
  const first = firstComponentChild(field)
  if (first === undefined || !isLayoutWrapper(first)) return first
  return fieldControlOf(first)
}

/** The control's own `props.id`, or `undefined` for a field with no control or an id-less one. */
export function extractFirstChildId(component: Component | undefined): string | undefined {
  const control = fieldControlOf((component ?? {}) as Node)
  const id = (control?.['props'] as Node | undefined)?.['id']
  return typeof id === 'string' ? id : undefined
}

/** Lower case, accents folded, one dash between words, no dash at either end. */
const idPart = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The id a labelled field mints for its control: unique on the page, readable, never empty. */
function mintedControlId(field: Node, control: Node, renderId: string): string {
  const props = (control['props'] ?? {}) as Node
  const name = props['name'] ?? control['name']
  const words = typeof name === 'string' && name !== '' ? name : String(field['fieldLabel'])
  const tail = idPart(words)
  const unique = idPart(renderId) || 'control'
  return tail === '' ? `field-${unique}` : `field-${unique}-${tail}`
}

/** Write `id` onto the control, through any layout wrapper around it. */
function withIdOnControl(node: Node, id: string): Node {
  if (!isLayoutWrapper(node)) return { ...node, props: { ...((node['props'] as Node) ?? {}), id } }
  const [inner, ...siblings] = node['children'] as readonly Node[]
  return { ...node, children: [withIdOnControl(inner as Node, id), ...siblings] }
}

/**
 * A labelled `field` whose control has no id, with one minted on the control;
 * any other component unchanged. `renderId` is the render's own unique id
 * (React `useId`), which is what keeps two such fields apart on one page.
 */
export function withFieldControlId(component: Component, renderId: string): Component {
  const field = component as Node
  if (field['type'] !== 'field' || typeof field['fieldLabel'] !== 'string') return component
  const control = fieldControlOf(field)
  if (control === undefined || extractFirstChildId(component) !== undefined) return component
  const id = mintedControlId(field, control, renderId)
  const [first, ...rest] = field['children'] as readonly Node[]
  return { ...component, children: [withIdOnControl(first as Node, id), ...rest] } as Component
}
