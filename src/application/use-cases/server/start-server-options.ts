/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { BootstrapTokenRepository } from '@/application/ports/repositories/auth/bootstrap-token-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { AccountProvisioner } from '@/application/ports/services/account-provisioner'
import type { ContentDirReader } from '@/application/ports/services/content-dir-reader'
import type { CSSCompiler } from '@/application/ports/services/css-compiler'
import type { DatabaseMigrator } from '@/application/ports/services/database-migrator'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { LocalAiProbe } from '@/application/ports/services/local-ai-probe'
import type { PageRenderer } from '@/application/ports/services/page-renderer'
import type { ServerFactory } from '@/application/ports/services/server-factory'
import type { StaticSiteGenerator } from '@/application/ports/services/static-site-generator'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { TypeScriptValidator } from '@/application/ports/services/typescript-validator'
import type { Logger } from '@/infrastructure/logging/logger'

/**
 * What a server start is given — the caller's options — and what it reads from
 * its context.
 */

/**
 * Server configuration options
 */
export interface StartOptions {
  /**
   * Port number for the HTTP server
   * @default 3000
   */
  readonly port?: number

  /**
   * Hostname to bind the server to
   * @default "localhost"
   */
  readonly hostname?: string

  /**
   * Directory to serve static files from during development
   * Files are served at their relative path (e.g., `publicDir/logos/x.png` → `/logos/x.png`)
   */
  readonly publicDir?: string

  /**
   * Static-asset serving was explicitly DISABLED (`--no-publicDir`, or the
   * `SOVRIUM_PUBLIC_DIR=none` sentinel) — as opposed to merely unconfigured.
   *
   * The distinction exists for exactly one consumer: the page-search index,
   * which is built under the data directory and served at `/sovrium-search/*`
   * whenever the config declares a page-scoped `search-input` (see
   * `prepareSearchArtifacts`). An operator who asked for no static assets at
   * all gets no search either, so "unset" and "refused" cannot collapse to
   * the same value.
   */
  readonly publicDirOptOut?: boolean

  /**
   * Hash of the configuration content for change detection
   */
  readonly configHash?: string

  /**
   * Path to the configuration file for restart/reload
   */
  readonly configPath?: string

  /**
   * This boot is a `--watch` RELOAD rather than a first start: suppress the
   * multi-line startup banner, which the operator read seconds ago and which
   * the watcher replaces with a one-line summary.
   *
   * Deliberately NOT `silent`. That flag additionally suppresses the lock
   * file, its cleanup registration, and the `[server] listening on <url>`
   * line — the line `waitForServerPort` parses to
   * decide a server is up. A reload keeps all three and drops only the banner.
   */
  readonly reload?: boolean
}

/** What `startServer` reads from its context; `createAppLayer` provides all of it. */
export type StartServerRequirements =
  | ServerFactory
  | PageRenderer
  | AccountProvisioner
  | AuthRepository
  // The boot sweep of automation runs a previous server left behind.
  | AutomationRunOutcomeRepository
  // Boot-time first-admin bootstrap. `createAppLayer` carries both reads, so
  // `startServer` names them rather than binding a layer of its own.
  | BootstrapTokenRepository
  | EmailSender // the notices the boot sweep of interrupted runs may send
  | Logger
  | StorageService
  | TypeScriptValidator
  | DatabaseMigrator
  | LocalAiProbe
  // The page-search index step. All are members of `createAppLayer`, so no
  // caller had to widen what it provides (see `prebuild-search-index.ts`).
  | CSSCompiler
  | StaticSiteGenerator
  | ContentDirReader
