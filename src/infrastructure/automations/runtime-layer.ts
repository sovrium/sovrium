/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AiServiceLive } from '@/infrastructure/ai/ai-service-live'
import { SpeechServiceLive } from '@/infrastructure/ai/speech/speech-service-live'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { AiEmbeddingRepositoryActive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
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
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { ServerOriginLive } from '@/infrastructure/server/server-origin-live'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import type { Context } from 'effect'

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
 * - `LinkRepository` (via `LinkRepositoryLive`) for the `link/*` handlers, which
 *   call the same `createLink`/`updateLink`/`deleteLink` use-cases the admin
 *   console does — so a step and an operator refuse the same reserved and
 *   config-declared slugs.
 * - `DataSourceRepository` (via `DataSourceRepositoryLive`) so a RECORD-event
 *   trigger can hydrate many-to-one relationship fields in the envelope by
 *   fetching the related row by id.
 * - `ServerOrigin` (via `ServerOriginLive`) so `link/create` can hand back an
 *   ABSOLUTE address. A step has no request to read a `Host` header from, and
 *   the alternative — deriving it from `PORT` — yields `http://localhost:0`
 *   wherever the OS picked the port, which is an address that passes every
 *   well-formedness check and opens nowhere.
 *
 * Lives in `infrastructure/automations/` (not in the presentation route
 * folder) so non-route entry points — the live cron scheduler in
 * `infrastructure/scheduling/` and any future background worker — can
 * provide the same runtime without crossing layer boundaries.
 *
 * ── This is the ONLY composition of the automation runtime ───────────────────
 *
 * It used to have a smaller twin in `infrastructure/layers/table-layer.ts`,
 * built for the record-event trigger path and missing `AuthRepository`,
 * `AutomationApprovalRepository`, `AiService`, `StorageService` and
 * `ImageTransformService`. A handler needing one of those therefore worked from
 * a webhook or cron trigger and failed from a record trigger — a difference no
 * type caught, because the twin asserted its result carried no requirements
 * instead of proving it. The two are now one layer, and the assertion is gone,
 * so the compiler checks the claim.
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
  // `SpeechService` — the `ai/transcribe` handler's speech endpoint (`STT_*`).
  // Its construction reads env only and cannot fail; an unset `STT_PROVIDER`
  // yields an inert service whose transcriptions fail with a readable reason.
  SpeechServiceLive,
  // `AiEmbeddingRepository` — the knowledge-retrieval read behind the
  // `ai/agent` handler. `Active` and never `Live`: the Postgres-only pgvector
  // `<=>` search is invalid SQL on SQLite, and the handler swallows a retrieval
  // failure, so binding the wrong arm would turn every SQLite retrieval into a
  // silent zero-chunk answer while the write side kept filling the index.
  AiEmbeddingRepositoryActive,
  // `StorageServiceLive` can still fail while it is BEING BUILT, and that failure
  // is an operator misconfiguration rather than an outcome of the automation run.
  // Left in the error channel it would widen every caller's tagged union with an
  // infrastructure error none of their `_tag` switches name, which is how it
  // stayed invisible: the old `as Effect<A, E, never>` cast erased it rather than
  // anyone handling it. `Layer.orDie` states the decision instead of hiding it.
  // Only CONSTRUCTION is affected; the service's own `StorageError`s still travel
  // the error channel as before.
  //
  // WHAT CAN STILL FAIL, precisely — the S3 bucket LIST is no longer on the list.
  // It became an advisory, once-per-process probe (`storage/s3-bucket-probe.ts`)
  // so that an unreachable bucket cannot take down a composition serving routes
  // that never touch storage. What remains is the local provider's
  // `mkdir -p` + write-access check and the bytea provider's `SELECT 1`, both of
  // which are genuine initialisation rather than reachability polling, and the
  // bytea one is pinned as a BOOT FAILURE by shipped specs
  // (`[internal ref]…`, 5 assertions on
  // `Bytea storage initialization failed (DATABASE_URL)`).
  Layer.orDie(StorageServiceLive),
  ImageTransformServiceLive,
  AnalyticsRepositoryLive,
  DataSourceRepositoryLive,
  ServerOriginLive,
  // `LinkRepository` — the links write use-cases (`createLink`/`updateLink`/
  // `deleteLink`) an automation step reaches for. Unlike its neighbours this
  // Layer is built from `Database`, so it is provided here rather than merged
  // bare; the admin route composes it the same way.
  Layer.provide(LinkRepositoryLive, DatabaseLive)
)

/**
 * Cross a Promise boundary WITHOUT leaving the caller's services behind.
 *
 * The code-action sandbox hands user JavaScript an `actions.ref(...)` method,
 * and `automation:call` hands it an invoker; both must return a Promise,
 * because that is the contract a `function` inside the sandbox can consume.
 * The boundary is therefore imposed by the sandbox, not chosen by the run loop.
 *
 * What was chosen — and is now undone — is what supplied the sub-program's
 * services on the far side of it. Each invocation used to `Effect.provide` the
 * whole `AutomationRuntimeLayer` again, so an automation whose code action
 * dispatched N steps built N copies of every repository, the AI service and the
 * storage service included, while the fiber that called it already held one
 * set. This takes the CALLER's services instead: `Effect.context` captures what
 * the run loop is running on, and nothing is constructed here at all.
 *
 * It lives in infrastructure rather than in the use case for the reason
 * standing rule E1 gives — a use case declares `R` and never runs — and beside
 * `AutomationRuntimeLayer` because this is the other half of the same seam.
 */
export const runOnAutomationServices =
  <R>(services: Context.Context<R>) =>
  <A, E>(program: Effect.Effect<A, E, R>): Promise<A> =>
    Effect.runPromiseWith(services)(program)

/**
 * Provide the automation runtime's required infrastructure layers.
 *
 * Used by route handlers (webhook/manual triggers), the live cron
 * scheduler, and other background dispatchers so they can run an
 * `executeAutomationRun`-shaped Effect program against the production
 * dependency graph.
 */
export function provideAutomationRuntime<A, E, R>(program: Effect.Effect<A, E, R>) {
  return Effect.provide(program, AutomationRuntimeLayer)
}
