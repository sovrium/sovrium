/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The refinement worker of an AI-compute field, as the PostgreSQL `NOTIFY`
 * listener receives it.
 *
 * The listener (`infrastructure/database/ai-compute-listener.ts`) is the only
 * point where a `pg_notify` event can be observed, and the worker it forwards to
 * is an application use-case (`refineAiComputeField`). Rather than the listener
 * importing the use-case upward, the server's composition root hands the worker
 * in when it builds the listener layer.
 */

import type {
  AiComputeStatusRepository,
  AiComputeStoreError,
} from '@/application/ports/repositories/ai/ai-compute-status-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { AiComputeKind } from '@/domain/models/app/tables/ai-compute-baseline'
import type { AiComputeRequestConfig } from '@/domain/models/app/tables/ai-compute-build-request'
import type { Effect } from 'effect'

/** Input to one refinement. */
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

/** The worker: provider call, status writes and the origin-marked write-back. */
export type AiComputeRefine = (
  input: RefineAiComputeFieldInput
) => Effect.Effect<RefineOutcome, AiComputeStoreError, AiService | AiComputeStatusRepository>
