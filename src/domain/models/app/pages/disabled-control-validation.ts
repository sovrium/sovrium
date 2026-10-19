/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two ways a `disabledWhen` / `disabledReason` pair can be written that
 * could never do what its author wrote, refused when the app starts:
 *
 *  1. **A `button`'s `disabledWhen` with no record-binding ancestor.** The
 *     condition is judged on the record the button is drawn on; outside a
 *     binding there is none, so the button would be usable everywhere — the
 *     same structural fact `visibility.record` is refused on, read by the same
 *     walk (`record-binding-walk.ts`).
 *  2. **A `disabledReason` with no `disabledWhen`**, on a page `button`, a
 *     table's row action or a button field: it describes a state the control
 *     never reaches.
 *  3. **A `button`'s `editSelect` with no record-binding ancestor.** The picker
 *     opens on the record's current value and its pick replaces that record's
 *     field in the action; off a record there is neither. Unlike `disabledWhen`
 *     it is NOT refused under a `dataSource.system` read: a system row is a
 *     record the button is drawn on, and nothing about the picker is judged on
 *     the server.
 */

import { boundNodesOf, describeNode } from './record-binding-walk'
import { reachedControlNodesOf } from './record-control-service'

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object under `value`, itself included, at any depth. */
const objectsUnder = (value: unknown): readonly Node[] => {
  if (Array.isArray(value)) return value.flatMap(objectsUnder)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(objectsUnder)]
}

/**
 * The `button` components and table row actions under `value` that carry a
 * `disabledWhen` — the two page controls a record can disable. (A form field's
 * `disabledWhen` is the forms grammar, and is not one of them.)
 */
const disableableControlsUnder = (value: unknown): readonly Node[] =>
  objectsUnder(value).flatMap((node) => {
    const own = node['type'] === 'button' && node['disabledWhen'] !== undefined ? [node] : []
    if (node['type'] !== 'table' || !Array.isArray(node['columns'])) return own
    const actions = node['columns'].flatMap((column: unknown) =>
      isRecord(column) && Array.isArray(column['actions']) ? column['actions'] : []
    )
    return [
      ...own,
      ...actions.filter(
        (item: unknown): item is Node => isRecord(item) && item['disabledWhen'] !== undefined
      ),
    ]
  })

/** How a refusal names a control. */
const controlLabelOf = (node: Node): string =>
  node['type'] === 'button' ? describeNode(node) : 'table row action'

/** A reason with nothing to explain. */
const isOrphanReason = (node: Node): boolean =>
  node['disabledReason'] !== undefined && node['disabledWhen'] === undefined

/** How a refusal names the page. */
const pageLabelOf = (page: Node): string =>
  typeof page['name'] === 'string' ? `page '${page['name']}'` : 'a page'

/** The first refusal of one page, or `undefined`. */
const pageRefusal = (page: unknown): string | undefined => {
  if (!isRecord(page)) return undefined
  const label = pageLabelOf(page)
  const unboundButtons = boundNodesOf(page).filter(
    ({ node, boundByAncestor }) => node['type'] === 'button' && !boundByAncestor
  )
  const unbound = unboundButtons.find(({ node }) => node['disabledWhen'] !== undefined)
  if (unbound !== undefined) {
    return `${label} declares disabledWhen on a ${describeNode(unbound.node)} with no record-binding ancestor — the condition is judged on the record the button is drawn on, so here the button would never be disabled. Nest it under a component with a dataSource (a list or gallery row template, or a single-record container), or use props.disabled for a button disabled everywhere`
  }
  const unboundPicker = unboundButtons.find(({ node }) => node['editSelect'] !== undefined)
  if (unboundPicker !== undefined) {
    return `${label} declares editSelect on a ${describeNode(unboundPicker.node)} with no record-binding ancestor — the picker opens on the record's current value and its pick replaces that value in the action, so off a record there is nothing to pre-fill or replace. Nest it under a component with a dataSource (a list or gallery row template, a single-record container, or a dataSource.system read), or bind the page to one record`
  }
  const reached = reachedControlNodesOf(page)
  const unjudged = disableableControlsUnder([page['components'], page['layout']]).find(
    (node) => !reached.has(node)
  )
  if (unjudged !== undefined) {
    return `${label} declares disabledWhen on a ${controlLabelOf(unjudged)} whose record is not read from a declared table — the condition is judged on a record of a table the page binds with a dataSource, so here it would never be disabled. Bind it under a component or page dataSource naming a table, in the page components (not its layout)`
  }
  const orphan = objectsUnder([page['components'], page['layout']]).find(isOrphanReason)
  return orphan === undefined
    ? undefined
    : `${label} declares disabledReason with no disabledWhen — the reason describes a state the control never reaches. Add the disabledWhen it explains, or remove the reason`
}

/** The refusal of a button field carrying a reason with no condition, or `undefined`. */
const fieldRefusal = (tables: readonly unknown[]): string | undefined => {
  const field = tables
    .flatMap((table) => (isRecord(table) && Array.isArray(table['fields']) ? table['fields'] : []))
    .find((candidate: unknown) => isRecord(candidate) && isOrphanReason(candidate))
  if (!isRecord(field)) return undefined
  return `button field '${String(field['name'])}' declares disabledReason with no disabledWhen — the reason describes a state the button never reaches. Add the disabledWhen it explains, or remove the reason`
}

/**
 * The refusal of a control with a `disabledWhen` inside an `app.components`
 * template, or `undefined`: a template is placed after the page's controls are
 * given their ids, so a control written there is never judged.
 */
const templateRefusal = (templates: readonly unknown[]): string | undefined => {
  const template = templates.find((entry) => disableableControlsUnder(entry).length > 0)
  if (!isRecord(template)) return undefined
  const name = typeof template['name'] === 'string' ? `'${template['name']}'` : ''
  return `component template ${name} declares disabledWhen on a control inside it — a control in a template is not judged on its record, so it would never be disabled. Write the control in the page that places the template`
}

/** Minimal shape needed to validate disabled controls. */
interface AppForDisabledControlValidation {
  readonly pages?: unknown
  readonly tables?: unknown
  readonly components?: unknown
}

/**
 * Validate every `disabledWhen` / `disabledReason` of the app.
 *
 * @returns `true` when every pair can do what it says, or the message naming
 * the first that cannot.
 */
export const validateDisabledControls = (app: AppForDisabledControlValidation): string | true => {
  const pages = Array.isArray(app.pages) ? app.pages : []
  const pageError = pages.map(pageRefusal).find((message) => message !== undefined)
  if (pageError !== undefined) return pageError
  const templateError = templateRefusal(Array.isArray(app.components) ? app.components : [])
  if (templateError !== undefined) return templateError
  return fieldRefusal(Array.isArray(app.tables) ? app.tables : []) ?? true
}
