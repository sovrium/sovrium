/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { FormSubmissionRepositoryLive } from '@/infrastructure/database/repositories/form-submission-repository-live'
import { ShareLinkRepositoryLive } from '@/infrastructure/database/repositories/share-link-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'

const ShareLinkRuntimeLayer = Layer.mergeAll(
  ShareLinkRepositoryLive,
  FormSubmissionRepositoryLive,
  TableLive
)

export function provideShareLinkLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, ShareLinkRuntimeLayer) as Effect.Effect<A, E, never>
}
