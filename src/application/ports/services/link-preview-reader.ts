/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect } from 'effect'

/**
 * Where a record write hands the addresses its stored records hold in a
 * previewing field (`bubble.linkPreviews`): the reader fetches each page in
 * the background, through the guarded egress, and caches its card, so the
 * write never waits on another site.
 *
 * A `Context.Reference` whose default reads nothing, as the record-change feed
 * is: a write run outside `TableLive` (a seed from the CLI) costs nothing.
 */
export interface LinkPreviewReaderShape {
  /** Start reading `addresses` in the background; returns at once. */
  readonly readInBackground: (addresses: readonly string[]) => Effect.Effect<void>
}

export const LinkPreviewReader = Context.Reference<LinkPreviewReaderShape>(
  'sovrium/LinkPreviewReader',
  { defaultValue: () => ({ readInBackground: () => Effect.void }) }
)
