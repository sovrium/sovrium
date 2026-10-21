/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { sentChatCallerKey } from '@/presentation/api/agents/chat-conversation-store'
import { stopChatTurn } from '@/presentation/api/agents/chat-stream-events'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { Context, TypedResponse } from 'hono'

/**
 * Stop the caller's streamed turn on a session — `POST /api/ai/chat/stop`.
 *
 * `202` when a turn of hers was in flight there (it ends at its next step
 * boundary, as `done { stopReason: 'stopped' }`), `404` when none is: already
 * finished, never started, or someone else's.
 */
export const handleChatStop = async (c: Context): Promise<Response | TypedResponse<unknown>> => {
  const body = await validateRequest(c, Schema.Struct({ sessionId: Schema.NonEmptyString }))
  if (!body.success) return body.response
  const { sessionId } = body.data
  // A signed-out caller stops only her own browser's turn; one with no id has none.
  const caller = sentChatCallerKey(c, getSessionContext(c)?.userId ?? 'anonymous')
  return caller !== undefined && stopChatTurn(caller, sessionId)
    ? c.json({ status: 'stopping', sessionId }, 202)
    : notFound(c, 'No turn in progress on this session.')
}
