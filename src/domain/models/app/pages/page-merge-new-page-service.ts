/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A NEW page, drawn on a board of a page the config does not declare, as
 * `sovrium design-system import --pages --new-pages` writes it.
 *
 * The page is named from the board and its path is the one the board's root
 * gives (`data-sovrium-path`), else `/<name>`. Its access is the access of the
 * declared page the root names as its model (`data-sovrium-like`), else none
 * of its own, so the app's default holds. A path a declared page already
 * takes, or a model the config does not declare, is refused by name: a new
 * page never shadows or guesses at an existing one.
 *
 * The page starts empty, and every kit node drawn on the board is merged into
 * it as an addition, by the one merge every page goes through.
 *
 * Pure: no I/O, the same inputs always give the same entry.
 */

import type { DrawnPage } from './page-drawing'

type Node = Readonly<Record<string, unknown>>

/** A new page's entry before its nodes are merged in, and what the report says of it. */
export interface NewPageEntry {
  readonly entry: Node
  readonly created: { readonly path: string; readonly like?: string | undefined }
}

/**
 * A page path as the pages router answers it: `/usage/` is served as `/usage`
 * (the trailing-slash normalizer), so the two are one address.
 */
const routeKeyOf = (path: unknown): unknown =>
  typeof path === 'string' && path.length > 1 ? path.replace(/\/+$/, '') || '/' : path

/** Why a new page cannot be: its path is taken, or the page it is like is undeclared. */
const refusalOf = (
  drawn: DrawnPage,
  declared: readonly Node[],
  wanted: {
    readonly path: string
    readonly like: string | undefined
    readonly model: Node | undefined
  }
): string | undefined => {
  const board = drawn.drawing ?? drawn.page
  const taker = declared.find((page) => routeKeyOf(page['path']) === routeKeyOf(wanted.path))
  if (taker !== undefined) {
    return `The board ${board} draws a new page at ${wanted.path}, which the page ${String(taker['name'])} already takes; give the board another data-sovrium-path, or draw that page on its own board.`
  }
  return wanted.like !== undefined && wanted.model === undefined
    ? `The board ${board} is like the page ${wanted.like}, which this config does not declare; name a declared page in data-sovrium-like.`
    : undefined
}

/**
 * The entry a board of an undeclared page starts as, or why it is refused.
 *
 * @param drawn - the board's drawing.
 * @param declared - the config's page entries, as it writes them, and the new pages before it.
 */
export const newPageEntryOf = (
  drawn: DrawnPage,
  declared: readonly Node[]
): NewPageEntry | { readonly refusal: string } => {
  const path = drawn.declares?.path ?? `/${drawn.page}`
  const { like } = drawn.declares ?? {}
  const model = like === undefined ? undefined : declared.find((page) => page['name'] === like)
  const refusal = refusalOf(drawn, declared, { path, like, model })
  if (refusal !== undefined) return { refusal }
  const access = model?.['access']
  return {
    entry: {
      name: drawn.page,
      path,
      ...(access === undefined ? {} : { access }),
      components: [],
    },
    created: { path, ...(like === undefined ? {} : { like }) },
  }
}
