/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Paging through a connection operation's answers: the items of one page, the
 * URL of the first page and of the page after the one just read, for each
 * `pagination.style` an operation declares.
 */

import { nextLinkOf, readDotPath, withQueryParam } from './connection-request'
import type { OperationPagination } from '@/domain/models/app/connections'

/** What paging reads of one answer: its decoded body and its `Link` header. */
interface PageBody {
  readonly body: unknown
  readonly link: string | null
}

/** The items of one page, per the operation's pagination. */
export const itemsOf = (pagination: OperationPagination, body: unknown): readonly unknown[] => {
  const items = pagination.itemsPath === undefined ? body : readDotPath(body, pagination.itemsPath)
  return Array.isArray(items) ? items : []
}

const isPresent = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

/** Where the reader stands: the URL just read, and the page number / offset it carried. */
export interface PagePosition {
  readonly url: string
  readonly page: number
  readonly offset: number
}

/**
 * A `Link: rel="next"` URL, resolved against the page just read and kept only
 * when it stays on the same origin: the request carries the connection's
 * credentials, and a next link pointing elsewhere must not receive them.
 */
const sameOriginLink = (current: string, next: string | undefined): string | undefined => {
  if (next === undefined) return undefined
  try {
    const resolved = new URL(next, current)
    return resolved.origin === new URL(current).origin ? resolved.toString() : undefined
  } catch {
    return undefined
  }
}

/** The 'page' style: the page number the response names, else the one after. */
const nextPageNumberUrl = (
  pagination: Extract<OperationPagination, { readonly style: 'page' }>,
  current: PagePosition,
  body: unknown,
  items: readonly unknown[]
): string | undefined => {
  if (pagination.nextPath !== undefined) {
    const next = readDotPath(body, pagination.nextPath)
    return isPresent(next)
      ? withQueryParam(current.url, pagination.pageParam, String(next))
      : undefined
  }
  return items.length === 0
    ? undefined
    : withQueryParam(current.url, pagination.pageParam, String(current.page + 1))
}

/** The URL of the page after `answer`, or `undefined` when it was the last one. */
export const nextPageUrl = (
  pagination: OperationPagination,
  current: PagePosition,
  answer: PageBody
): string | undefined => {
  const items = itemsOf(pagination, answer.body)
  switch (pagination.style) {
    case 'page':
      return nextPageNumberUrl(pagination, current, answer.body, items)
    case 'offset':
      return items.length < pagination.limit
        ? undefined
        : withQueryParam(
            current.url,
            pagination.offsetParam,
            String(current.offset + pagination.limit)
          )
    case 'cursor': {
      const cursor = readDotPath(answer.body, pagination.cursorPath)
      return isPresent(cursor)
        ? withQueryParam(current.url, pagination.cursorParam, String(cursor))
        : undefined
    }
    case 'link':
      return sameOriginLink(current.url, nextLinkOf(answer.link))
    case 'lastItem':
      return afterLastItemUrl(pagination, current.url, answer.body, items)
  }
}

/**
 * The 'lastItem' style: the next page is asked for with the id of the last item
 * just read (`starting_after`). It ends on an empty page, or — when the
 * operation names one — on a `hasMorePath` answering false, which is what spares
 * the extra request an empty page would cost.
 */
const afterLastItemUrl = (
  pagination: Extract<OperationPagination, { readonly style: 'lastItem' }>,
  url: string,
  body: unknown,
  items: readonly unknown[]
): string | undefined => {
  if (items.length === 0) return undefined
  if (pagination.hasMorePath !== undefined && readDotPath(body, pagination.hasMorePath) === false) {
    return undefined
  }
  const lastId = readDotPath(items[items.length - 1], pagination.idField ?? 'id')
  return isPresent(lastId) ? withQueryParam(url, pagination.afterParam, String(lastId)) : undefined
}

/** The first page's URL: the page / offset parameters set to their start values. */
export const firstPageUrl = (pagination: OperationPagination, url: string): string => {
  if (pagination.style === 'page') {
    return withQueryParam(url, pagination.pageParam, String(pagination.startPage ?? 1))
  }
  if (pagination.style === 'offset') {
    return withQueryParam(
      withQueryParam(url, pagination.offsetParam, '0'),
      pagination.limitParam,
      String(pagination.limit)
    )
  }
  return url
}
