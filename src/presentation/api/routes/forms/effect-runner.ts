/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AutomationRuntimeLayer } from '@/infrastructure/automations/runtime-layer'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { FormSubmissionRepositoryLive } from '@/infrastructure/database/repositories/forms/form-submission-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

/**
 * Runtime layers required by the standalone form submission endpoint.
 *
 * Includes:
 * - `FormSubmissionRepository` for the audit ledger write.
 * - `TableRepository` (via `TableLive`) so `submitTo.table` writes can
 *   reuse the existing `createRecordProgram` without re-implementing
 *   table validation, type coercion, and field-permission filtering.
 * - `DataSourceRepository` so the inline-prefill revalidation pass
 *   (Y-5) can re-fetch the host page's `$parent` record at submit time
 *   and return 422 when it has been deleted out from under the form.
 * - `AutomationRuntimeLayer` so form-triggered automations can fire
 *   inside the same Effect request scope. Mirrors how table routes
 *   provide `TableWithAutomationsLive` to the record
 *   create handler — keeping every automation entry point on the same
 *   service set.
 */
const FormsRuntimeLayer = Layer.mergeAll(
  FormSubmissionRepositoryLive,
  TableLive,
  DataSourceRepositoryLive,
  AutomationRuntimeLayer,
  // F-11 (file-uploads): storage adapter is needed at submission time so
  // multipart payloads can be uploaded to the form's resolved bucket and
  // their canonical `{ url, name, size, mimeType }` metadata written into
  // attachment columns + propagated to the trigger envelope.
  StorageServiceLive,
  // F-04: analytics repository so the
  // emitFormSubmissionAnalyticsEvent step can write the unified
  // `system.analytics_events` row after a successful submission. Gated
  // by the env / app / form three-layer toggle.
  AnalyticsRepositoryLive
)

export function provideFormsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, FormsRuntimeLayer) as Effect.Effect<A, E, never>
}
