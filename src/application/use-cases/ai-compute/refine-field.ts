/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import {
  buildAiComputeChatRequest,
  type AiComputeRequestConfig,
} from '@/domain/services/ai-compute/build-request'
import {
  readAiComputeStatus,
  upsertAiComputeStatus,
} from '@/infrastructure/database/ai-compute-status-repository'
import {
  readCurrentFieldValue,
  writeBackRefinedValue,
} from '@/infrastructure/database/ai-compute-writeback'
import { logDebug } from '@/infrastructure/logging/logger'
import type { AiComputeKind } from '@/domain/services/ai-compute/baseline'

export interface RefineAiComputeFieldInput {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
  readonly kind: AiComputeKind
  readonly source: string
  readonly baselineValue: unknown
  readonly config: AiComputeRequestConfig
}

export type RefineOutcome = 'refined' | 'failed' | 'skipped' | 'noop'

const JSON_KINDS: ReadonlySet<AiComputeKind> = new Set(['ai-extract', 'ai-sentiment'])
const ARRAY_KINDS: ReadonlySet<AiComputeKind> = new Set(['ai-tag'])

const normalizeForCompare = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(trimmed))
      } catch {
        return value
      }
    }
    return value
  }
  return JSON.stringify(value)
}

const parseRefinedValue = (kind: AiComputeKind, content: string): unknown => {
  const trimmed = content.trim()
  if (JSON_KINDS.has(kind)) {
    try {
      const parsed = JSON.parse(trimmed)
      const isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      return isObject ? parsed : undefined
    } catch {
      return undefined
    }
  }
  if (ARRAY_KINDS.has(kind)) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed
    } catch {
    }
    return trimmed
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  }
  return trimmed
}

const isAlreadyInFlight = (status: {
  readonly status: string
  readonly attempt: number
}): boolean => status.status === 'pending' && status.attempt >= 1

interface RefineKey {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
}

const applyRefinement = (
  input: RefineAiComputeFieldInput,
  key: RefineKey,
  attempt: number,
  content: string
): Effect.Effect<RefineOutcome, never> =>
  Effect.gen(function* () {
    const { tableName, recordId, fieldName, kind, baselineValue, appId } = input
    const current = yield* Effect.promise(() =>
      readCurrentFieldValue(tableName, recordId, fieldName)
    )
    if (normalizeForCompare(current) !== normalizeForCompare(baselineValue)) {
      yield* Effect.promise(() => upsertAiComputeStatus(key, 'skipped', { attempt }))
      return 'skipped'
    }
    const refined = parseRefinedValue(kind, content)
    if (refined === undefined) {
      yield* Effect.promise(() =>
        upsertAiComputeStatus(key, 'failed', {
          attempt,
          error: 'Provider reply was not shape-valid for the field type',
        })
      )
      return 'failed'
    }
    yield* Effect.promise(() =>
      writeBackRefinedValue({ appId, tableName, recordId, fieldName, value: refined })
    )
    yield* Effect.promise(() => upsertAiComputeStatus(key, 'refined', { attempt }))
    return 'refined'
  })

export const refineAiComputeField = (
  input: RefineAiComputeFieldInput
): Effect.Effect<RefineOutcome, never, AiService> =>
  Effect.gen(function* () {
    const { tableName, recordId, fieldName, kind, source, baselineValue, config, appId } = input
    const key: RefineKey = { appId, tableName, recordId, fieldName }

    const existing = yield* Effect.promise(() => readAiComputeStatus(key))
    if (existing && isAlreadyInFlight(existing)) return 'noop'
    const attempt = (existing?.attempt ?? 0) + 1
    yield* Effect.promise(() => upsertAiComputeStatus(key, 'pending', { attempt }))

    const request = buildAiComputeChatRequest({
      kind,
      source,
      baselineValue: stringOrUndefined(baselineValue),
      config,
    })
    if (!request) {
      yield* Effect.promise(() => upsertAiComputeStatus(key, 'skipped', { attempt }))
      return 'skipped'
    }

    const ai = yield* AiService
    const replyResult = yield* ai.chat(request).pipe(Effect.either)
    if (replyResult._tag === 'Left') {
      const { message } = replyResult.left
      logDebug(`[ai-compute] refinement failed for ${tableName}.${fieldName}: ${message}`)
      yield* Effect.promise(() => upsertAiComputeStatus(key, 'failed', { attempt, error: message }))
      return 'failed'
    }

    return yield* applyRefinement(input, key, attempt, replyResult.right.content)
  })

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined
