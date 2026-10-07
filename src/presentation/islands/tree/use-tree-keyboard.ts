/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The tree's keyboard, after the WAI tree pattern: Up / Down through the
 * visible nodes, Right opens a branch (or steps into it), Left closes it (or
 * steps out to the parent), Home / End, Enter or Space to select, and a printed
 * letter jumps to the next node whose label starts with it.
 */

import type { Forest } from './tree-model'
import type { KeyboardEvent } from 'react'

interface TreeKeyboard {
  readonly forest: Forest
  readonly visible: readonly string[]
  readonly open: ReadonlySet<string>
  readonly current: string | undefined
  readonly toggle: (id: string, open: boolean) => void
  readonly select: (id: string) => void
  readonly focus: (id: string) => void
}

/** The node a horizontal arrow lands on, after opening or closing what it must. */
function horizontal(key: string, ctx: TreeKeyboard, id: string): string | undefined {
  const node = ctx.forest.nodes.get(id)
  if (node === undefined) return undefined
  const isOpen = ctx.open.has(id) && node.childIds.length > 0
  if (key === 'ArrowRight') {
    if (node.childIds.length === 0) return undefined
    if (!isOpen) {
      ctx.toggle(id, true)
      return undefined
    }
    return node.childIds[0]
  }
  if (isOpen) {
    ctx.toggle(id, false)
    return undefined
  }
  return node.parentId
}

/** The next node after `id` whose label starts with `letter`, wrapping round. */
function typeAhead(ctx: TreeKeyboard, id: string, letter: string): string | undefined {
  const start = ctx.visible.indexOf(id)
  const ordered = [...ctx.visible.slice(start + 1), ...ctx.visible.slice(0, start + 1)]
  return ordered.find((candidate) =>
    ctx.forest.nodes.get(candidate)?.label.toLocaleLowerCase().startsWith(letter)
  )
}

/** Where a key moves focus to from `id`, or `undefined` to stay. */
function target(key: string, ctx: TreeKeyboard, id: string): string | undefined {
  const index = ctx.visible.indexOf(id)
  if (key === 'ArrowDown') return ctx.visible[index + 1]
  if (key === 'ArrowUp') return index > 0 ? ctx.visible[index - 1] : undefined
  if (key === 'Home') return ctx.visible[0]
  if (key === 'End') return ctx.visible.at(-1)
  if (key === 'ArrowRight' || key === 'ArrowLeft') return horizontal(key, ctx, id)
  return key.length === 1 ? typeAhead(ctx, id, key.toLocaleLowerCase()) : undefined
}

const HANDLED = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])

export const useTreeKeyboard =
  (ctx: TreeKeyboard) =>
  (event: KeyboardEvent<HTMLElement>): void => {
    const id = ctx.current
    if (id === undefined || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      ctx.select(id)
      return
    }
    if (!HANDLED.has(event.key) && event.key.length !== 1) return
    event.preventDefault()
    const next = target(event.key, ctx, id)
    if (next !== undefined) ctx.focus(next)
  }
