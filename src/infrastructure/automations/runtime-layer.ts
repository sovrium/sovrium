/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { AiServiceLive } from '@/infrastructure/ai/ai-service-live'
import { SpeechServiceLive } from '@/infrastructure/ai/speech/speech-service-live'
import { SvgRasterizerLive } from '@/infrastructure/assets/svg-rasterizer-live'
import { ConfigAccountProvisionerLive } from '@/infrastructure/auth/better-auth/config-account-provisioner-live'
import { OAuthClientRegistrarLive } from '@/infrastructure/auth/better-auth/oauth-client-registrar-live'
import { BrowserDriverLive } from '@/infrastructure/browser/browser-driver-live'
import { OAuthTokenClientLive } from '@/infrastructure/connections/oauth-token-client-live'
import { SentinelTokensLive } from '@/infrastructure/connections/sentinel-tokens-live'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { AuditLogRepositoryLive } from '@/infrastructure/database/repositories/admin/audit-log-repository-live'
import { AiEmbeddingRepositoryActive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { OrganizationTeamRepositoryLive } from '@/infrastructure/database/repositories/auth/organization-team-repository-live'
import { AutomationApprovalRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-approval-repository-live'
import { AutomationDigestRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-digest-repository-live'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'
import { AutomationRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-repository-live'
import { AutomationRunOutcomeRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-outcome-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import { AutomationStateRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-state-repository-live'
import { BrowserSessionRepositoryLive } from '@/infrastructure/database/repositories/automations/browser-session-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { EmailSenderLive } from '@/infrastructure/email/email-sender-live'
import { DocumentRendererLive } from '@/infrastructure/export/document-renderer-live'
import { OfficeConverterLive } from '@/infrastructure/export/office-converter-live'
import { PdfEditorLive } from '@/infrastructure/export/pdf-editor-live'
import { PdfToolkitLive } from '@/infrastructure/export/pdf-toolkit-live'
import { ProcessRunnerLive } from '@/infrastructure/process/process-runner-live'
import { SystemdSupervisorLive } from '@/infrastructure/process/systemd-supervisor-live'
import { ServerOriginLive } from '@/infrastructure/server/server-origin-live'
import { ImageTransformServiceLive } from '@/infrastructure/storage/image-transform-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { TemplateEngineLive } from '@/infrastructure/templates/template-engine-live'
import { AutomationFiberBridgeLive } from './automation-fiber-bridge-live'

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
 * - `DocumentRenderer` (via `DocumentRendererLive`) for the `document/*`
 *   handlers' HTML → PDF / image renders.
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
 * Do not build a smaller twin for one trigger path (e.g. record events in
 * `infrastructure/layers/table-layer.ts`). A twin missing `AuthRepository`,
 * `AutomationApprovalRepository`, `AiService`, `StorageService` or
 * `ImageTransformService` makes a handler needing one of those work from a
 * webhook or cron trigger and fail from a record trigger — a difference no type
 * catches if the twin asserts its result carries no requirements instead of
 * proving it. With one layer and no such assertion, the compiler checks the
 * claim.
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
  // `AutomationRunOutcomeRepository` — the failure history a finished run's
  // alert and automatic pause decide from (`notifyPlatformFailure`,
  // `autoPauseOnFailures`), both on the run loop's own failure path.
  AutomationRunOutcomeRepositoryLive,
  // `AuditLogRepository` — the automatic pause reads the last resume and writes
  // its own entry through the audit funnel.
  AuditLogRepositoryLive,
  // `EmailSender` — the `email/send` step and the operator notices a failing run sends.
  EmailSenderLive,
  AutomationApprovalRepositoryLive,
  AuthRepositoryLive,
  // `OrganizationTeamRepository` — the `auth/addToGroup` / `auth/removeFromGroup`
  // steps write the group membership through the same team store the console's
  // account-groups route writes.
  OrganizationTeamRepositoryLive,
  AutomationStateRepositoryLive,
  AutomationDigestRepositoryLive,
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  // `SentinelTokens` — the connection-authenticated steps refuse to send the
  // test seeder's placeholder credential upstream, and the connection status
  // reads report it as disconnected.
  SentinelTokensLive,
  // `TemplateEngine` — `{{...}}` substitution in step props, trigger
  // conditions, webhook responses and invoked action templates.
  TemplateEngineLive,
  // `OAuthTokenClient` — the token-endpoint requests and the refresh lock the
  // connection-authenticated steps (`http/*`, `webhook/*`, `connection/*`) use.
  OAuthTokenClientLive,
  // `AutomationFiberBridge` — the sandbox's Promise boundary and the registry
  // of record-event runs a step starts without waiting for.
  AutomationFiberBridgeLive,
  // `ConfigAccountProvisioner` — the `auth/createUser` step; loads the auth
  // engine lazily, so a deployment without `auth:` never pays for it.
  ConfigAccountProvisionerLive,
  // `OAuthClientRegistrar` — the sign-in client steps (`auth/*OAuthClient*`),
  // over the app's own OAuth provider; loads the engine lazily like the above.
  OAuthClientRegistrarLive,
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
  // `DocumentRenderer` — HTML → PDF / image for the `document/*` steps
  // (`RENDERER_*`, [internal ref]). Building it starts no browser: Chrome is spawned
  // or connected on the first render and closed when the layer is released.
  DocumentRendererLive,
  // `BrowserDriver` — the `browser/run` steps (`BROWSER_*`, [internal ref]). Building it
  // starts nothing; the first session starts the process's one Chrome, shared
  // with the renderer above. `BrowserSessionRepository` keeps sealed jars.
  BrowserDriverLive,
  BrowserSessionRepositoryLive,
  // `SvgRasterizer` — SVG → PNG in the binary (resvg-wasm, loaded on first use).
  SvgRasterizerLive,
  // `PdfToolkit` — PDF structure for `pdf/*` (pure JS, loaded on first use).
  PdfToolkitLive,
  // `PdfEditor` — split, pages, marks, forms, inspect, pictures for `pdf/*`.
  PdfEditorLive,
  // `OfficeConverter` — Office files → PDF for `document/convert` (`OFFICE_*`).
  OfficeConverterLive,
  AnalyticsRepositoryLive,
  DataSourceRepositoryLive,
  ServerOriginLive,
  // `InstanceSupervisor` — the `instance/*` steps: systemd units and release
  // directories of the other apps on this host, run through its private
  // `ProcessRunner` (no step reaches the runner directly). Building it spawns
  // nothing and reads no environment, so a deployment that never switches
  // SOVRIUM_HOST_ACTIONS on pays nothing for it.
  Layer.provide(SystemdSupervisorLive, ProcessRunnerLive),
  // `LinkRepository` — the links write use-cases (`createLink`/`updateLink`/
  // `deleteLink`) an automation step reaches for. Unlike its neighbours this
  // Layer is built from `Database`, so it is provided here rather than merged
  // bare; the admin route composes it the same way.
  Layer.provide(LinkRepositoryLive, DatabaseLive)
)
