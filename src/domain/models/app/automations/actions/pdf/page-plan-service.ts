/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { selectPages } from '../../page-range-service'

/**
 * WHICH PAGES A `pdf/*` STEP TOUCHES — decided before any byte is written,
 * so a step that cannot do what it says fails with nothing stored.
 *
 * Every page here is a 0-based index; every message names pages as the
 * config writes them, from 1.
 */

/** A plan, or the reason it cannot be made. */
export type PagePlan<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string }

const planned = <T>(value: T): PagePlan<T> => ({ ok: true, value })
const refused = <T>(reason: string): PagePlan<T> => ({ ok: false, reason })

const pagesWord = (count: number): string => `${count} page${count === 1 ? '' : 's'}`

/** The pages `pages` names, or the range that runs past the end, with the file's page count. */
export const pagesOrRefusal = (pages: unknown, pageCount: number): PagePlan<readonly number[]> => {
  const written = pages === undefined || pages === null ? undefined : String(pages)
  const selection = selectPages(written, pageCount)
  return selection.ok
    ? planned(selection.indexes)
    : refused(
        `pages "${selection.range}" go past the last page; the file has ${pagesWord(pageCount)}`
      )
}

/** `split`: the pages of each part, in order. */
export const splitGroups = (
  props: { readonly ranges?: unknown; readonly every?: unknown },
  pageCount: number
): PagePlan<readonly (readonly number[])[]> => {
  const all = Array.from({ length: pageCount }, (_, index) => index)
  if (Array.isArray(props.ranges)) {
    const parts = props.ranges.map((range) => pagesOrRefusal(range, pageCount))
    const failed = parts.find((part) => !part.ok)
    if (failed !== undefined && !failed.ok) return refused(failed.reason)
    return planned(parts.flatMap((part) => (part.ok ? [part.value] : [])))
  }
  const every = typeof props.every === 'number' && props.every >= 1 ? Math.floor(props.every) : 1
  return planned(
    Array.from({ length: Math.ceil(pageCount / every) }, (_, part) =>
      all.slice(part * every, part * every + every)
    )
  )
}

const listOfPages = (indexes: readonly number[]): string =>
  `${indexes.length === 1 ? 'page' : 'pages'} ${indexes.map((index) => index + 1).join(', ')}`

/** `reorder`: the new order, which must name every page exactly once. */
export const reorderPlan = (pages: unknown, pageCount: number): PagePlan<readonly number[]> => {
  const order = pagesOrRefusal(pages, pageCount)
  if (!order.ok) return order
  const repeated = order.value.filter((page, at) => order.value.indexOf(page) !== at)
  if (repeated.length > 0) {
    return refused(`the new order lists ${listOfPages([...new Set(repeated)])} more than once`)
  }
  const missing = Array.from({ length: pageCount }, (_, index) => index).filter(
    (index) => !order.value.includes(index)
  )
  return missing.length > 0
    ? refused(`the new order leaves out ${listOfPages(missing)}; it must name every page once`)
    : order
}

/** `delete`: the pages that stay, in order; at least one must. */
export const deletePlan = (pages: unknown, pageCount: number): PagePlan<readonly number[]> => {
  const removed = pagesOrRefusal(pages, pageCount)
  if (!removed.ok) return removed
  const kept = Array.from({ length: pageCount }, (_, index) => index).filter(
    (index) => !removed.value.includes(index)
  )
  return kept.length === 0
    ? refused('it would delete every page; at least one page must stay')
    : planned(kept)
}

/** A rotation added to a page's own, as one of 0, 90, 180 and 270. */
export const addRotation = (current: number, angle: number): number =>
  (((current + angle) % 360) + 360) % 360

/**
 * The text of each page number: `{n}` the page's number, `{total}` the number
 * the last numbered page carries. The first numbered page carries `startAt`,
 * by default its own position in the file.
 */
export const pageNumberTexts = (
  indexes: readonly number[],
  numbering: { readonly format?: unknown; readonly startAt?: unknown }
): readonly string[] => {
  const format = typeof numbering.format === 'string' ? numbering.format : '{n}'
  const first = typeof numbering.startAt === 'number' ? numbering.startAt : (indexes[0] ?? 0) + 1
  const total = String(first + indexes.length - 1)
  return indexes.map((_, at) =>
    format.replaceAll('{n}', String(first + at)).replaceAll('{total}', total)
  )
}

/** The name of part `n`: `{n}` filled in, or `-n` before the extension when there is none. */
export const partName = (name: string, n: number): string => {
  if (name.includes('{n}')) return name.replaceAll('{n}', String(n))
  const slash = name.lastIndexOf('/')
  const dot = name.lastIndexOf('.')
  return dot > slash + 1 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`
}
