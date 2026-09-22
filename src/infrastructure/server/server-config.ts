/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The configuration a booted server is built from.
 *
 * Extracted from `server.ts` so that the Hono composition root, the Bun
 * listener and the startup report can all name it without importing the entry
 * point they are themselves assembled into.
 *
 * Every field here is about SERVING. A render wants strictly less — see
 * `RenderAppConfig` in `application/ports/services/server-factory.ts`, which is
 * this shape minus everything a socket implies — and reaches it through
 * `render-app.ts` rather than through a flag on this type.
 */

import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { DatabaseStartupReport } from '@/application/ports/services/server-factory'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * Server configuration options
 */
export interface ServerConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly publicDir?: string
  readonly silent?: boolean
  /**
   * A `--watch` reload rather than a first start. Skips the multi-line startup
   * banner ONLY — the lock file, its cleanup registration and the
   * `[server] listening on <url>` line are all kept, because a reloaded server
   * is exactly as live as a freshly booted one and must stay discoverable as
   * such. That is the whole reason this is a separate flag from `silent`.
   */
  readonly reload?: boolean
  /**
   * The receipt of a database startup this process already ran — its banner
   * rows are reused and the chain behind them is not repeated. See
   * `ServerFactoryConfig.databaseStartup`.
   */
  readonly databaseStartup?: DatabaseStartupReport
  readonly configHash?: string
  readonly configPath?: string
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      readonly previewMode?: boolean
      readonly requestQuery?: Readonly<Record<string, string>>
      /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
      readonly urlLanguage?: string
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Optional so SSG and legacy callers that don't yet pass through the
   * RSS pipeline keep working — the route handler 404s when undefined.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  /** Plaintext bootstrap token surfaced in the startup banner exactly once when defined. */
  readonly bootstrapToken?: string
}
