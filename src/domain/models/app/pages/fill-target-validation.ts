/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `fill` action's `target` must name a component on its page.
 *
 * `target` is the `props.id` of the form, `input` or `textarea` the fill writes
 * into. The schema checks it is a non-empty string, not that a component on
 * the page carries it — so a typo (`composr`) validated and the click then
 * filled nothing, silently, since a target absent at click time is a no-op by
 * design (its form may sit in a closed dialog).
 *
 * ─── WHAT IS CHECKED ───────────────────────────────────────────────────────
 *
 * Every fill written on a page — a list's `onRowClick`, a button's `action`, a
 * board's `drag.onDrop[].action`, at any depth — against every component id on
 * that page, a closed dialog's or drawer's children included: they are in the
 * page, only not drawn yet.
 *
 * Only what can be known statically is refused. A target spelled with a
 * `$record.` / `{{ }}` token is left alone, and so is every fill on a page that
 * places a component template (`$ref` / `component:`), or carries an id built
 * from a token: the template body or the token may supply the id. A fill
 * written inside a template body is not checked either — which page it lands
 * on is the placement's business.
 */

/** Minimal shape needed to validate fill targets. */
interface AppForFillTargetValidation {
  readonly pages?: unknown
}

/** A value built from a token rather than written out. */
const isDynamic = (value: string): boolean => value.includes('$') || value.includes('{{')

/** Every object under `node`, itself included, at any depth. */
const objectsUnder = (node: unknown): readonly Readonly<Record<string, unknown>>[] => {
  if (Array.isArray(node)) return node.flatMap(objectsUnder)
  if (node === null || typeof node !== 'object') return []
  const record = node as Readonly<Record<string, unknown>>
  return [record, ...Object.values(record).flatMap(objectsUnder)]
}

/** The `props.id` a component carries, or `undefined`. */
const componentId = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const id = (record['props'] as Readonly<Record<string, unknown>> | null | undefined)?.['id']
  return typeof id === 'string' ? id : undefined
}

/** The `target` of a fill action, or `undefined` when `record` is not one. */
const fillTarget = (record: Readonly<Record<string, unknown>>): string | undefined =>
  record['type'] === 'fill' && typeof record['target'] === 'string' && 'value' in record
    ? record['target']
    : undefined

/** Whether `record` places a component template, by `$ref` or `component:`. */
const isPlacement = (record: Readonly<Record<string, unknown>>): boolean =>
  typeof record['$ref'] === 'string' ||
  (typeof record['component'] === 'string' && record['type'] === undefined && !('action' in record))

/** The refusal for one page, or `undefined` when every static target is there. */
const pageRefusal = (page: unknown): string | undefined => {
  const objects = objectsUnder((page as { readonly components?: unknown } | null)?.components)
  const ids = objects.flatMap((record) => {
    const id = componentId(record)
    return id === undefined ? [] : [id]
  })
  if (ids.some(isDynamic) || objects.some(isPlacement)) return undefined
  const known = new Set(ids)
  const missing = objects
    .flatMap((record) => {
      const target = fillTarget(record)
      return target === undefined ? [] : [target]
    })
    .find((target) => !isDynamic(target) && !known.has(target))
  if (missing === undefined) return undefined
  const { name } = page as { readonly name?: unknown }
  const where = typeof name === 'string' ? ` (on page '${name}')` : ''
  return (
    `fill: target '${missing}'${where} names no component on its page: no component there has props.id '${missing}'. ` +
    `Give the form, input or textarea to fill that id, or correct the target.`
  )
}

/**
 * Validate every fill written on a page against the component ids of that page.
 *
 * @returns `true` when every static target names a component on its page, or
 * the message naming the first one that does not.
 */
export const validateAllFillTargets = (app: AppForFillTargetValidation): string | true => {
  const pages = Array.isArray(app.pages) ? app.pages : []
  const refusal = pages.map(pageRefusal).find((message) => message !== undefined)
  return refusal ?? true
}
