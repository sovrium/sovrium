/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a card click does — a board card, a calendar event, a gallery card and
 * its hover-overlay button — in the one place the three islands share.
 *
 * A card takes the two verbs a grid row takes. `navigate` follows a path the
 * config wrote, filled with the card's `$record.*` values; those values are
 * whatever the row holds, so the filled path is held to the rule a list item
 * click already applies (`../list/list-row-click.ts`): a path on this site,
 * normalised by {@link toSafeRedirectPath}, and nothing else. A value that
 * points to another site (`//host/…`, `https://host/…`) or at a script
 * (`javascript:…`) yields no click at all — the card draws no link and the
 * reader stays on the page. `openSheet` opens the named drawer on the card's
 * record. `seek` moves a `video` or `audio` player on the page to the moment
 * the card's record names.
 *
 * The drawer and seek events is the bus's own `dispatch`, spelled inline: importing the
 * event-bus module from a card island moves a shared chunk boundary and costs
 * the kanban island bytes it does not have. The payload stays typed against
 * the bus's contract.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import type { OpenDrawerDetail, SeekDetail } from './event-bus'
import type { TableRecord } from './types'

/**
 * The click that follows a card's filled navigate path, or `undefined` when
 * the path does not stay on this site.
 */
export function cardPathClick(path: string): (() => void) | undefined {
  const target = toSafeRedirectPath(path)
  return target === undefined ? undefined : () => globalThis.location.assign(target)
}

/**
 * Open the drawer `id` on a card's record. `table` is the card's bound table,
 * which the drawer needs to bind the record only to the forms editing it.
 */
export function openCardDrawer(id: string, record: TableRecord, table?: string): void {
  const detail = {
    id,
    record: { ...record },
    ...(table ? { table } : {}),
  } satisfies OpenDrawerDetail
  document.dispatchEvent(new CustomEvent('sovrium:open-drawer', { detail }))
}

/** A `seek` action as config hands it over — read loosely, checked here. */
interface CardSeek {
  readonly target?: unknown
  readonly time?: unknown
  readonly play?: unknown
}

/**
 * Move a player on the page to the moment a card's record names (a list item,
 * a table row, a board or gallery card). `fill` is the island's own record
 * substitution — each island already carries one, so this module imports
 * none. The moment is resolved HERE and handed to the always-loaded runtime's
 * `sovrium:seek` listener; a moment that reads as no number seeks nowhere.
 */
export function seekFromCard(seek: CardSeek, fill: (template: string) => string): void {
  if (typeof seek.target !== 'string') return
  const text = typeof seek.time === 'string' ? fill(seek.time).trim() : ''
  const time = typeof seek.time === 'number' ? seek.time : text === '' ? NaN : Number(text)
  if (!Number.isFinite(time)) return
  const detail = {
    target: fill(seek.target),
    time,
    ...(seek.play === false && { play: false }),
  } satisfies SeekDetail
  document.dispatchEvent(new CustomEvent('sovrium:seek', { detail }))
}
