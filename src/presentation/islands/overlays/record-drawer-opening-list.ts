/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { subscribe, type OpenDrawerDetail } from '@/presentation/islands/runtime/event-bus'

/**
 * The list that last opened each drawer, by drawer id: the ids on screen and
 * where they sit in the whole list. Recorded by a listener registered when this
 * module loads — before any row is clicked — so the FIRST open is captured too:
 * the navigation is not on screen to hear it, because the drawer only draws it
 * once it has opened.
 */
const OPENING_LISTS = new Map<string, OpenDrawerDetail>()
subscribe('sovrium:open-drawer', (detail) => {
  OPENING_LISTS.set(detail.id, detail)
})

/**
 * The opening list's ids, where the record stands in it (`-1` when it is not
 * in it), and where those ids sit in the whole list (`offset`, `total`) when
 * the opener said — a step hands both on, so the place stays absolute.
 */
export function openingPlace(
  id: string | undefined,
  recordId: string | undefined
): Pick<OpenDrawerDetail, 'offset' | 'total'> & {
  readonly siblings: readonly string[]
  readonly index: number
} {
  const opened = id === undefined ? undefined : OPENING_LISTS.get(id)
  const siblings = opened?.siblings ?? []
  return {
    siblings,
    index: recordId === undefined ? -1 : siblings.indexOf(recordId),
    offset: opened?.offset,
    total: opened?.total,
  }
}

/**
 * Where the record stands in the list that opened the drawer — `26 of 28` with
 * the host's words — counted through the whole list when the opener said where
 * its rows sit in it, else through the rows it had on screen; `undefined` when
 * the drawer knows no list holding it.
 */
export function drawerPosition(
  id: string | undefined,
  recordId: string | undefined,
  words: string | undefined
): string | undefined {
  const { siblings, index, offset, total } = openingPlace(id, recordId)
  if (index === -1) return undefined
  return fillPlaceholders(words ?? '{position} of {count}', {
    position: String((offset ?? 0) + index + 1),
    count: String(total ?? siblings.length),
  })
}
