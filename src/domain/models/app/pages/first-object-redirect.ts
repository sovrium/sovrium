/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Every `{field}` placeholder of an `hrefTemplate`. A STATIC literal. */
const HREF_PLACEHOLDER = /\{([^{}]+)\}/g

/**
 * The list binding a page's `redirectToFirst` resolves its first row from.
 *
 * Two shapes, because two ways of declaring a list exist and both are accepted
 * by `redirectToFirstViolations`: a component-level rows endpoint, or a
 * page-level DB binding in `mode: 'list'`.
 */
export type FirstObjectSource =
  | { readonly kind: 'system'; readonly endpoint: string; readonly rowsKey: string }
  | { readonly kind: 'table'; readonly table: string }

/**
 * Find the list source `redirectToFirst` should read.
 *
 * A page-level `dataSource` in `mode: 'list'` wins when present: it is the
 * page's own binding, so it is what "the page's list" means when both exist.
 * Otherwise the FIRST component-level rows endpoint reachable in the tree is
 * used — a page with two would be ambiguous, and document order is the only
 * defensible tie-break that does not invent a new config key to express one.
 *
 * Returns `undefined` when nothing resolves. Decode already refuses a
 * `redirectToFirst` on a page with no list at all, so that is a runtime
 * degradation path, not the normal case.
 */
export function findFirstObjectSource(page: unknown): FirstObjectSource | undefined {
  if (!isRecord(page)) return undefined

  const pageSource = page['dataSource']
  if (
    isRecord(pageSource) &&
    pageSource['mode'] === 'list' &&
    typeof pageSource['table'] === 'string'
  ) {
    return { kind: 'table', table: pageSource['table'] }
  }

  return walk(page['components'])
    .concat(walk(page['layout']))
    .map(readSystemSource)
    .find((source): source is FirstObjectSource => source !== undefined)
}

function readSystemSource(node: Readonly<Record<string, unknown>>): FirstObjectSource | undefined {
  const { dataSource } = node
  if (!isRecord(dataSource)) return undefined
  const { system } = dataSource
  if (!isRecord(system) || typeof system['endpoint'] !== 'string') return undefined
  const rowsKey = typeof system['rowsKey'] === 'string' ? system['rowsKey'] : 'items'
  return { kind: 'system', endpoint: system['endpoint'], rowsKey }
}

/**
 * Fill an `hrefTemplate`'s `{field}` placeholders from a resolved row.
 *
 * Returns `undefined` when ANY placeholder has no usable value on the row.
 * That is deliberate and is the same instinct as the empty-collection rule:
 * a redirect built from a half-filled template points at a path that does not
 * exist, and a 302 to a 404 is strictly worse than rendering the page and
 * letting the operator see its own list.
 */
export function fillHrefTemplate(
  template: string,
  row: Readonly<Record<string, unknown>>
): string | undefined {
  const unresolved = [...template.matchAll(HREF_PLACEHOLDER)].some(
    ([, field]) => toPathValue(row[field ?? '']) === undefined
  )
  if (unresolved) return undefined

  return template.replaceAll(HREF_PLACEHOLDER, (_match, field: string) =>
    encodeURIComponent(toPathValue(row[field]) ?? '')
  )
}

/**
 * A row value usable in a URL path: a non-empty string, or a finite number /
 * boolean rendered as one. `null`, `undefined`, an empty string, and any
 * object (a nested bag, an attachment array) are NOT addresses.
 */
function toPathValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined
  if (typeof value === 'boolean') return String(value)
  return undefined
}

/** Depth-first collection of every object node — see `page-binding-validation.ts`. */
function walk(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(walk)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(walk)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
