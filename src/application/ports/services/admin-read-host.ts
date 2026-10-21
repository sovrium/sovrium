/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { KeptServerFailureReport } from '@/domain/kernel/url/issue-report-address'
import type { IssueReportFacts } from '@/domain/kernel/url/issue-report-failure'
import type { ConfigVersionResponse } from '@/domain/models/api/admin/config/version'
import type { App } from '@/domain/models/app'

/**
 * AdminReadHost — the facts an admin read needs from the process serving it,
 * which no use-case can compute for itself.
 *
 * An admin read is described once in the read registry and answered on two
 * surfaces (HTTP and MCP). Most reads are functions of the app and the store.
 * A few are functions of the SERVING PROCESS instead: the origin the caller
 * reached it at, the boot instant, the engine build, and the live
 * footprint telemetry. Those live in infrastructure or in the render tree,
 * which the application layer may not import — so each surface's adapter provides this service per call, built by
 * one presentation helper, and both surfaces answer from the same values.
 *
 * Provided by the adapters (`Effect.provideService`), never by the domain
 * runtime: the origin is per request, and the HTTP and MCP surfaces resolve it
 * differently (the request's own address, the bound origin).
 */
export class AdminReadHost extends Context.Service<
  AdminReadHost,
  {
    /** The public origin, with no trailing slash, the caller reached this instance at. */
    readonly origin: string
    /**
     * When this instance started — the ONE boot instant every admin read names:
     * the running server's boot, on the development timeline when the host is
     * pinned with `SOVRIUM_DEV_CLOCK` (the timeline its runs are stamped on).
     * The config version reports it as `startedAt`; the attention report counts
     * from it and, with the instance read, reports it as `bootedAt`.
     */
    readonly processStartedAt: string
    /** The engine build and runtime facts the config version answers. */
    readonly configVersion: Effect.Effect<ConfigVersionResponse>
    /**
     * The environmental footprint body for `app`, assembled from the live
     * telemetry and the object store's total. Validated by the read against its
     * wire schema.
     */
    readonly footprintOverview: (app: App) => Effect.Effect<unknown, never, StorageService>
    /**
     * Encode rows as CSV text, header row first (written even for zero rows),
     * in `columns` order — the one encoder every CSV export shares, so an HTTP
     * download and an MCP answer are the same bytes.
     */
    readonly encodeCsv: (
      rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
      columns: ReadonlyArray<string>
    ) => string
    /** The installation facts a bug report carries: version, platform, install channel, database. */
    readonly issueReportFacts: Effect.Effect<IssueReportFacts>
    /** The internal error this server kept under `requestId`, already scrubbed, if any. */
    readonly findServerFailure: (
      requestId: string
    ) => Effect.Effect<KeptServerFailureReport | undefined>
    /**
     * The most recent internal error this server kept that is Sovrium's to fix,
     * already scrubbed, if any — counting the ones answered a moment ago.
     */
    readonly findLatestServerFailure: Effect.Effect<KeptServerFailureReport | undefined>
  }
>()('AdminReadHost') {}

/**
 * Build the host for a caller that reached the instance at `origin`. The MCP
 * mount receives one from the composition root, because the presentation code
 * that builds it belongs to the admin HTTP surface.
 */
export type AdminReadHostFactory = (origin: string) => AdminReadHost['Service']
