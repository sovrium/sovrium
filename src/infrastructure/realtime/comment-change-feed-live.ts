/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { CommentChangeFeed } from '@/application/ports/services/comment-change-feed'
import { recordActivityChannel } from './app-connections'
import { publishToChannel } from './channel-manager'

/**
 * The live comment feed: a change is published on its record's activity
 * channel, naming the change and never its content. Its audience travels
 * beside it — `readers` for an approved comment, `moderators` otherwise, with
 * the author's id — for each connection to judge before anything is sent; the
 * frame a connection sends carries neither.
 */
export const CommentChangeFeedLive = Layer.succeed(CommentChangeFeed, {
  announce: (change) =>
    Effect.sync(() =>
      publishToChannel(recordActivityChannel(change.appId, change.table, change.recordId), {
        frame: {
          type: 'comment',
          event: change.event,
          table: change.table,
          recordId: change.recordId,
          commentId: change.commentId,
          timestamp: new Date().toISOString(),
        },
        audience: change.status === 'approved' ? 'readers' : 'moderators',
        authorId: change.authorId,
      })
    ),
})
