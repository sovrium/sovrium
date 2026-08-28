/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AiServiceLive } from '@/infrastructure/ai/ai-service-live'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { AutomationApprovalRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-approval-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-digest-repository-live'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-state-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

/**
 * Combined infrastructure layer required by the automation engine
 * (`executeAutomationRun` and its callers — `runWebhookAutomation`,
 * `runManualAutomation`, `runCronAutomation`, `triggerRecordEventAutomations`).
 *
 * Provides:
 * - `TableRepository` (via `TableLive`) for record-creating actions.
 * - `AutomationRepository` (via `AutomationRepositoryLive`) so the run loop
 *   can lazily seed `system.automation_definitions` on first trigger and
 *   resolve the `automation_id` FK that downstream tables (state, runs,
 *   digest, etc.) depend on.
 * - `AutomationStateRepository` (via `AutomationStateRepositoryLive`) for
 *   the `state:*` action operators (set, get, list, delete, increment).
 * - `AutomationDigestRepository` (via `AutomationDigestRepositoryLive`) for
 *   the `digest:*` action operators (collect, release).
 * - `ConnectionRepository` + `ConnectionTokenRepository` for the
 *   `http/request` handler's `connection: <name>` injection (oauth2 token
 *   lookup; static auth types do not need DB access).
 * - `ImageTransformService` (via `ImageTransformServiceLive`) for the
 *   `file/transformImage` handler's composed image pipeline (resize + optional
 *   format conversion).
 * - `AutomationApprovalRepository` (via `AutomationApprovalRepositoryLive`) for
 *   the `approval/request` handler's pending-row INSERT.
 * - `AuthRepository` (via `AuthRepositoryLive`) for the `auth/*` handlers
 *   (`assignRole`, `banUser`, `unbanUser` and their user-existence guard).
 *
 * Lives in `infrastructure/automations/` (not in the presentation route
 * folder) so non-route entry points — the live cron scheduler in
 * `infrastructure/scheduling/` and any future background worker — can
 * provide the same runtime without crossing layer boundaries.
 *
 * When future migration specs add handlers that depend on additional
 * repositories, extend this merged layer rather than spreading
 * infrastructure imports across each entry point.
 */
export const AutomationRuntimeLayer = Layer.mergeAll(
  TableLive,
  AutomationRepositoryLive,
  // `AutomationPauseRepository` — the operational-pause read every trigger
  // entry point performs before dispatch (`loadPausedAutomationNames`). It
  // belongs to the runtime layer rather than to each caller so that adding a
  // gate to a new trigger path cannot compile-fail for want of wiring.
  AutomationPauseRepositoryLive,
  AutomationRunRepositoryLive,
  AutomationApprovalRepositoryLive,
  AuthRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  AiServiceLive,
  StorageServiceLive,
  ImageTransformServiceLive,
  AnalyticsRepositoryLive
)

/**
 * Provide the automation runtime's required infrastructure layers.
 *
 * Used by route handlers (webhook/manual triggers), the live cron
 * scheduler, and other background dispatchers so they can run an
 * `executeAutomationRun`-shaped Effect program against the production
 * dependency graph.
 */
export function provideAutomationRuntime<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AutomationRuntimeLayer) as Effect.Effect<A, E, never>
}
