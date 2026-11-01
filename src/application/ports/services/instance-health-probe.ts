/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { InstanceComponentHealth } from '@/domain/models/api/admin/overview/attention'
import type { SupportedAiProvider } from '@/domain/models/process-env/ai/ai-providers'

/**
 * InstanceHealthProbe — one bounded probe per part of the instance the
 * console's Instance card judges: the database, the file storage and the AI
 * provider.
 *
 * Every probe is TOTAL and BOUNDED: it answers `healthy` when the part
 * answered within its short timeout and `degraded` when it failed, timed out
 * or could not be run, so reading the overview never fails and never waits
 * past a probe's budget. The AI and the S3 probes are cached for a minute per
 * endpoint, so an overview read reaches a provider at most once a minute; the
 * AI probe lists models and never asks for a completion.
 */
export class InstanceHealthProbe extends Context.Service<
  InstanceHealthProbe,
  {
    /** A trivial query (`SELECT 1`) within its timeout. */
    readonly database: Effect.Effect<InstanceComponentHealth>
    /** The configured storage provider's cheapest read within its timeout. */
    readonly storage: Effect.Effect<InstanceComponentHealth>
    /** The provider's model list answering below 500 within its timeout. */
    readonly aiProvider: (provider: SupportedAiProvider) => Effect.Effect<InstanceComponentHealth>
  }
>()('InstanceHealthProbe') {}
