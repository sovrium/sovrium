/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { RecordChangeFeed } from '@/application/ports/services/record-change-feed'
import { publishRecordChanges } from './record-change-publisher'

/**
 * The live change stream: a write program's announcement goes to the single
 * publishing point, which fans each row (or one resync notice) out to the
 * subscriptions on the touched tables. Part of `TableLive`.
 */
export const RecordChangeFeedLive = Layer.succeed(RecordChangeFeed, {
  announce: (announcement) => Effect.sync(() => publishRecordChanges(announcement)),
})
