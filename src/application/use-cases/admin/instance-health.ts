/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Instance card's health: how long the instance has been up, one verdict
 * per part it judges, and one for the whole.
 *
 * The three probes run concurrently and each is bounded by its own short
 * timeout, so the overview read waits at most one probe budget for them. A
 * part the instance does not have — no AI provider — carries no verdict at
 * all and does not count against the instance: "not configured" is a fact the
 * card states in words, not a health state.
 */

import { Effect } from 'effect'
import { InstanceHealthProbe } from '@/application/ports/services/instance-health-probe'
import { resolveAiProvider } from '@/domain/models/process-env/ai/ai-providers'
import type {
  AdminAttentionResponse,
  InstanceComponentHealth,
} from '@/domain/models/api/admin/overview/attention'

/** The health keys of the overview read. */
export type InstanceHealthFacts = Pick<
  AdminAttentionResponse,
  'uptimeMs' | 'health' | 'databaseHealth' | 'storageHealth' | 'aiProviderHealth'
>

/** Milliseconds between two instants, never negative. */
const elapsedMs = (from: string, to: string): number =>
  Math.max(0, Date.parse(to) - Date.parse(from)) || 0

/**
 * Probe the instance's parts and judge the whole: `degraded` exactly when one
 * judged part is. `uptimeMs` is `generatedAt − bootedAt`, from the very values
 * the read reports, so the two can never disagree.
 */
export const readInstanceHealth = Effect.fn('admin.instance-health')(function* (input: {
  readonly bootedAt: string
  readonly generatedAt: string
  readonly aiProvider: string | null
}) {
  const probe = yield* InstanceHealthProbe
  const aiProvider = input.aiProvider === null ? null : resolveAiProvider(input.aiProvider)
  // No provider, no verdict: the AI probe answers an empty list rather than a verdict.
  const aiProbe: Effect.Effect<ReadonlyArray<InstanceComponentHealth>> =
    aiProvider === null
      ? Effect.succeed([])
      : aiProvider === undefined
        ? Effect.succeed(['degraded'])
        : Effect.map(probe.aiProvider(aiProvider), (health) => [health])
  const [databaseHealth, storageHealth, [aiProviderHealth]] = yield* Effect.all(
    [probe.database, probe.storage, aiProbe],
    { concurrency: 'unbounded' }
  )
  const verdicts: ReadonlyArray<InstanceComponentHealth | undefined> = [
    databaseHealth,
    storageHealth,
    aiProviderHealth,
  ]
  const facts: InstanceHealthFacts = {
    uptimeMs: elapsedMs(input.bootedAt, input.generatedAt),
    health: verdicts.includes('degraded') ? 'degraded' : 'healthy',
    databaseHealth,
    storageHealth,
    ...(aiProviderHealth === undefined ? {} : { aiProviderHealth }),
  }
  return facts
})
