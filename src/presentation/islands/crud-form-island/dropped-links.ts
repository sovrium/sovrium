/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { holdsSameLinks, isLinkList, readLinkedIds } from '../parts/crud-form/record-picker-value'
import { type SubmitContext } from './types'

/** The ids the record held for a link list when the form last read it: as filled, then as saved. */
const loadedIds = (ctx: SubmitContext, name: string): readonly string[] =>
  readLinkedIds(ctx.heldValues?.[name] ?? '', true)

/**
 * The link lists an edit took every link off, sent as empty lists. The form
 * holds an emptied picker as `''`, which a save leaves out of the write as
 * "untouched" — so without this the links would stay. A list that still
 * names a link is sent as it is: the save REPLACES each list it sends
 * (`linkLists: 'replace'`), which removes the links it no longer names in the
 * same write, and a refused save removes none.
 */
export function emptiedLinkLists(ctx: SubmitContext): Readonly<Record<string, readonly never[]>> {
  const emptied = ctx.fields.filter(
    (field) =>
      isLinkList(field) &&
      (ctx.values[field.name] ?? '').trim() === '' &&
      loadedIds(ctx, field.name).length > 0
  )
  return Object.fromEntries(emptied.map((field) => [field.name, []]))
}

/**
 * The link lists the editor left as the record held them when the form read
 * it — the same ids, whatever their order. A save leaves them out: each list it
 * sends REPLACES the record's links, so sending an untouched one would take off
 * a link made meanwhile, elsewhere, that the form never showed.
 */
function untouchedLinkLists(ctx: SubmitContext): ReadonlySet<string> {
  const held = ctx.heldValues
  if (held === undefined) return new Set()
  const untouched = ctx.fields.filter(
    (field) =>
      isLinkList(field) && holdsSameLinks(ctx.values[field.name] ?? '', held[field.name] ?? '')
  )
  return new Set(untouched.map((field) => field.name))
}

/** The fields of an update less each link list the editor left as the record held it. */
export function withoutUntouchedLinkLists<V>(
  ctx: SubmitContext,
  fields: Readonly<Record<string, V>>
): Readonly<Record<string, V>> {
  const untouched = untouchedLinkLists(ctx)
  return Object.fromEntries(Object.entries(fields).filter(([name]) => !untouched.has(name)))
}
