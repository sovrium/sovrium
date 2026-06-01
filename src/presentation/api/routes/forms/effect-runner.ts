/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AutomationRuntimeLayer } from '@/infrastructure/automations/runtime-layer'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/data-source-repository-live'
import { FormSubmissionRepositoryLive } from '@/infrastructure/database/repositories/form-submission-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

const FormsRuntimeLayer = Layer.mergeAll(
  FormSubmissionRepositoryLive,
  TableLive,
  DataSourceRepositoryLive,
  AutomationRuntimeLayer,
  StorageServiceLive,
  AnalyticsRepositoryLive
)

export function provideFormsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, FormsRuntimeLayer) as Effect.Effect<A, E, never>
}
