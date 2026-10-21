/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How an AI message's JSON columns are written and read back: the question an
 * answer asked and the calls its turn ran (`tool_calls`), and the parts a
 * question was sent as (`parts`). A stored value that is not one of these
 * shapes reads back as nothing rather than failing the read.
 */

import type {
  AiMessageElicitation,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type {
  StoredToolCall,
  StoredToolCallOutcome,
} from '@/domain/models/app/agents/stored-tool-call-service'

/**
 * A question an agent asked (`ask_user`) rides in the assistant message's
 * `tool_calls` column, as the one call that message made — the column the
 * schema already holds for a message's tool calls, so no migration is needed.
 */
const ASK_USER_CALL = 'ask_user'

/** Every way a stored call can have ended; an unrecognised one reads back as `failed`. */
const STORED_OUTCOMES: ReadonlyArray<StoredToolCallOutcome> = [
  'ok',
  'denied',
  'failed',
  'pending-approval',
  'pending-input',
]

/** An answer's `tool_calls`: the question first ({@link elicitationOf}), then its calls. */
export const toToolCalls = (
  elicitation: AiMessageElicitation | undefined,
  calls: ReadonlyArray<StoredToolCall> = []
) => {
  const asked = elicitation === undefined ? [] : [{ name: ASK_USER_CALL, elicitation }]
  const toolCalls = [...asked, ...calls]
  return toolCalls.length === 0 ? {} : { toolCalls }
}

/** The question a stored message asked, read back from its `tool_calls`. */
export const elicitationOf = (
  toolCalls: unknown
): { readonly elicitation?: AiMessageElicitation } => {
  const call: unknown = Array.isArray(toolCalls) ? toolCalls[0] : undefined
  if (typeof call !== 'object' || call === null) return {}
  const { name, elicitation } = call as { readonly name?: unknown; readonly elicitation?: unknown }
  if (name !== ASK_USER_CALL || typeof elicitation !== 'object' || elicitation === null) return {}
  const { message, state, server } = elicitation as Readonly<Record<string, unknown>>
  return typeof message === 'string' && state === 'cancelled'
    ? { elicitation: { message, state, ...(typeof server === 'string' && { server }) } }
    : {}
}

/** One stored call read back, or nothing when the stored value is not one (or is a question asked). */
const storedCallOf = (raw: unknown): readonly StoredToolCall[] => {
  if (typeof raw !== 'object' || raw === null) return []
  const { id, name, outcome, table, rowCount } = raw as Readonly<Record<string, unknown>>
  if (typeof name !== 'string' || name === ASK_USER_CALL) return []
  return [
    {
      id: typeof id === 'string' ? id : '',
      name,
      outcome: STORED_OUTCOMES.find((known) => known === outcome) ?? 'failed',
      ...(typeof table === 'string' && { table }),
      ...(typeof rowCount === 'number' && { rowCount }),
    },
  ]
}

/** The calls a stored answer ran, read back from its `tool_calls`, the question it asked aside. */
export const storedCallsOf = (
  toolCalls: unknown
): { readonly toolCalls?: ReadonlyArray<StoredToolCall> } => {
  const calls = Array.isArray(toolCalls) ? toolCalls.flatMap(storedCallOf) : []
  return calls.length === 0 ? {} : { toolCalls: calls }
}

/** One stored part read back, or nothing when the stored value is not one. */
const partOf = (raw: unknown): readonly AiMessagePart[] => {
  if (typeof raw !== 'object' || raw === null) return []
  const { type, text, attachmentId, name } = raw as Record<string, unknown>
  if (type === 'text' && typeof text === 'string') return [{ type, text }]
  if ((type === 'file' || type === 'image') && typeof attachmentId === 'string') {
    return [{ type, attachmentId, name: typeof name === 'string' ? name : '' }]
  }
  return []
}

/** A stored message's `parts` column read back; absent for a message sent as text alone. */
export const partsOf = (raw: unknown): { readonly parts?: readonly AiMessagePart[] } =>
  Array.isArray(raw) ? { parts: raw.flatMap(partOf) } : {}
