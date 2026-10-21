/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page decode rule for the `openDialog` action: `component` must name a
 * `dialog` declared on the same page.
 *
 * The action can sit anywhere a component action does — a button, a menu
 * item, a command palette entry — so every object reachable from the page's
 * `components` and `layout` is read, not only the nodes. A dialog is told by
 * its `type: dialog` and its id (`props.id`, else `id`).
 *
 * Scoped so it cannot become a false refusal: a page that places a component
 * template (`$ref`, or `component:`) may hold the dialog inside that template,
 * which this pass does not expand, so such a page is not judged.
 *
 * Called from `collectPageBindingViolations` and from nowhere else, and shares
 * its contract: pure, no I/O, human-readable messages, empty when the page is
 * well-formed.
 *
 * @see ./page-binding-validation.ts — the caller, and the other families
 */

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object reachable from `value`, itself included. */
const objectsIn = (value: unknown): readonly Node[] => {
  if (Array.isArray(value)) return value.flatMap(objectsIn)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(objectsIn)]
}

/** The id a `dialog` node is opened by, when the object is one. */
const dialogIdOf = (node: Node): string | undefined => {
  if (node['type'] !== 'dialog') return undefined
  const props = isRecord(node['props']) ? node['props'] : {}
  const id = props['id'] ?? node['id']
  return typeof id === 'string' ? id : undefined
}

/** A template placement, which may hold a dialog this pass cannot see. */
const placesTemplate = (node: Node): boolean =>
  typeof node['$ref'] === 'string' ||
  (typeof node['component'] === 'string' && node['action'] === undefined)

export function openDialogTargetViolations(page: Node, label: string): readonly string[] {
  const objects = [...objectsIn(page['components']), ...objectsIn(page['layout'])]
  if (objects.some(placesTemplate)) return []
  const dialogs = new Set(objects.map(dialogIdOf).filter((id) => id !== undefined))
  return objects
    .filter((node) => node['action'] === 'openDialog' && typeof node['component'] === 'string')
    .map((node) => String(node['component']))
    .filter((id) => !dialogs.has(id))
    .map(
      (id) =>
        `${label} declares an openDialog action naming "${id}", but no dialog on the page has that id — declare a { type: dialog, props: { id: ${id} } } on the page, or name one that exists`
    )
}
