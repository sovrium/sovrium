/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `seek` client action: move a `video` or `audio` player on the page to a
 * moment, and play it from there unless the action says `play: false`.
 *
 * Two doors reach it, as they reach a fill, and both land in {@link applySeek}:
 *  - a `button[data-action-type="seek"]`, whose `data-action-config` carries
 *    the player id and the moment with its `$record.*` already resolved by the
 *    server;
 *  - the `sovrium:seek` event, dispatched by an island that resolved the moment
 *    against a record it holds (a list item, a table row, a card).
 *
 * A player that is not in the document when the action runs (it sits in a
 * dialog that is closed) is a silent no-op, and so is an id naming something
 * that is not a media element — a YouTube or Vimeo embed is an `iframe` the
 * page cannot drive. A moment past the end is clamped by the browser itself.
 */

import { bindActionButtons } from './client-event-delegate'
import { readActionConfig } from './fill-runtime'
import type { SeekDetail } from './event-bus'

/** Move the player and, unless told otherwise, play it from there. */
function applySeek(seek: Partial<SeekDetail> | undefined): void {
  if (typeof seek?.target !== 'string' || typeof seek.time !== 'number') return
  if (!Number.isFinite(seek.time) || seek.time < 0) return
  const player = document.getElementById(seek.target)
  if (!(player instanceof HTMLMediaElement)) return
  player.currentTime = seek.time
  // A refused play (no source, a blocked autoplay) leaves the player cued at the new moment.
  if (seek.play !== false) player.play().catch(() => undefined)
}

/** Bind the two doors: seek buttons, and the islands' `sovrium:seek` event. */
export function setupSeekHandlers(): void {
  bindActionButtons('seek', (button) => applySeek(readActionConfig<SeekDetail>(button)))
  document.addEventListener('sovrium:seek', (event) =>
    applySeek((event as CustomEvent<SeekDetail | undefined>).detail)
  )
}
