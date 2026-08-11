/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared async AI-compute refinement worker ([internal ref] Phase 2, design §4).
 *
 * One reusable worker invoked by BOTH engines — the only per-engine difference
 * is the trigger mechanism (Postgres NOTIFY listener vs SQLite post-write
 * `Effect.tap`), not the refinement logic, the override re-check, the status
 * writes, or the provider call. DRY across dialects.
 *
 * Lifecycle (writes to `system.ai_compute_status`):
 *   1. Idempotency guard — skip if a fresh `pending` is already in flight;
 *      otherwise UPSERT `pending` (attempt+1).
 *   2. Build the per-kind chat request (shared `buildAiComputeChatRequest`),
 *      call `AiService.chat` under `AiLive`.
 *   3. Override re-check — re-read the stored value; if the user set/edited it
 *      since enqueue (differs from baseline, not worker-written), mark `skipped`
 *      and DO NOT clobber.
 *   4. Write the refined value back ORIGIN-MARKED (realtime broadcasts,
 *      automations/webhooks do NOT re-fire — structural), UPSERT `refined`.
 *   5. Provider failure → baseline stays, UPSERT `failed` + error. The original
 *      write already returned 2xx; refinement is best-effort.
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

/** Input to {@link refineAiComputeField}. */
export interface RefineAiComputeFieldInput {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
  readonly kind: AiComputeKind
  /** Concatenated source content (joined the same way as the baseline). */
  readonly source: string
  /** The deterministic baseline value the synchronous write produced. */
  readonly baselineValue: unknown
  readonly config: AiComputeRequestConfig
}

/** Terminal refinement outcome (mirrors the status lifecycle). */
export type RefineOutcome = 'refined' | 'failed' | 'skipped' | 'noop'

/** Object-shaped kinds whose refined value is parsed from a JSON reply. */
const JSON_KINDS: ReadonlySet<AiComputeKind> = new Set(['ai-extract', 'ai-sentiment'])
/** Array-shaped kinds whose refined value is a list of strings. */
const ARRAY_KINDS: ReadonlySet<AiComputeKind> = new Set(['ai-tag'])

/**
 * Normalize a value for the override re-check comparison. The enqueue-time
 * baseline and the read-back stored value can carry the SAME logical value in
 * different shapes across dialects: an object-kind baseline is a `::text` JSON
 * string in the PG NOTIFY payload but a parsed object when read back (and a JSON
 * string on SQLite). Canonicalize JSON on both sides so the re-check only fires
 * on a genuine user edit — not on a serialization-form difference.
 */
const normalizeForCompare = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        // @effect-diagnostics effect/preferSchemaOverJson:off
        return JSON.stringify(JSON.parse(trimmed))
      } catch {
        return value
      }
    }
    return value
  }
  // @effect-diagnostics effect/preferSchemaOverJson:off
  return JSON.stringify(value)
}

/**
 * Parse a provider reply into the stored value shape for `kind`. Returns
 * `undefined` when the reply is NOT shape-valid for a structured kind
 * (sentiment/extract) — i.e. it does not parse to a non-array object. The
 * worker treats `undefined` as a refinement failure: the deterministic baseline
 * is the guaranteed floor and must never be clobbered by a malformed reply (a
 * provider that returns prose instead of the requested JSON keeps the baseline).
 */
const parseRefinedValue = (kind: AiComputeKind, content: string): unknown => {
  const trimmed = content.trim()
  if (JSON_KINDS.has(kind)) {
    try {
      // @effect-diagnostics effect/preferSchemaOverJson:off
      const parsed = JSON.parse(trimmed)
      const isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      return isObject ? parsed : undefined
    } catch {
      return undefined
    }
  }
  if (ARRAY_KINDS.has(kind)) {
    try {
      // @effect-diagnostics effect/preferSchemaOverJson:off
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through to comma-split
    }
    return trimmed
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  }
  return trimmed
}

/**
 * Whether the worker should skip because another enqueue is already in flight.
 * A fresh `pending` with `attempt >= 1` means a previous invocation is mid-call;
 * a second enqueue for the same key short-circuits (in-process idempotency).
 */
const isAlreadyInFlight = (status: {
  readonly status: string
  readonly attempt: number
}): boolean => status.status === 'pending' && status.attempt >= 1

/** The status-table key for a refinement target. */
interface RefineKey {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
}

/**
 * Apply a successful provider reply: re-check for a user override (a user edit
 * since enqueue wins → `skipped`, no clobber), else write the refined value back
 * origin-marked and mark `refined`. Extracted to keep the worker under the
 * per-generator statement cap.
 */
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
      // Malformed reply for a structured kind — keep the baseline as the floor.
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

/**
 * Run the refinement for a single AI-compute field. Best-effort: every failure
 * is captured in the status row (never thrown to the original write). The
 * returned Effect requires `AiService` (the caller provides `AiLive`).
 */
export const refineAiComputeField = (
  input: RefineAiComputeFieldInput
): Effect.Effect<RefineOutcome, never, AiService> =>
  Effect.gen(function* () {
    const { tableName, recordId, fieldName, kind, source, baselineValue, config, appId } = input
    const key: RefineKey = { appId, tableName, recordId, fieldName }

    // 1. Idempotency / concurrency guard.
    const existing = yield* Effect.promise(() => readAiComputeStatus(key))
    if (existing && isAlreadyInFlight(existing)) return 'noop'
    const attempt = (existing?.attempt ?? 0) + 1
    yield* Effect.promise(() => upsertAiComputeStatus(key, 'pending', { attempt }))

    // 2. Build the request + call the provider.
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

    // 3–4. Override re-check + origin-marked write-back.
    return yield* applyRefinement(input, key, attempt, replyResult.right.content)
  })

/** Carry the baseline value through as the categorize prompt's chosen hint. */
const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined
