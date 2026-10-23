/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { LinkPreviewReader } from '@/application/ports/services/link-preview-reader'
import { trackBackgroundRun } from '@/infrastructure/automations/background-runs'
import { readLinkPreviews } from './link-preview-cache'

/**
 * The live reader: each write's addresses are read on a detached fiber the
 * shutdown drain waits for, so a write returns before any page is fetched.
 * Part of `TableLive`.
 */
export const LinkPreviewReaderLive = Layer.succeed(LinkPreviewReader, {
  readInBackground: (addresses) =>
    addresses.length === 0
      ? Effect.void
      : Effect.asVoid(
          Effect.forkDetach(
            trackBackgroundRun(
              // effect-promise: total -- `readLinkPreviews` catches every failure of every read and records it in the cache as a failed read; it never rejects.
              Effect.promise(() => readLinkPreviews(addresses)).pipe(
                Effect.withSpan('egress.read-link-previews', {
                  attributes: { count: addresses.length },
                })
              )
            )
          )
        ),
})
