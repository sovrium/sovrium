/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Hono app configuration for route setup
 */
export interface HonoAppConfig {
  readonly app: App
  readonly publicDir?: string
  /**
   * Where the embedded operator console is mounted — one placement, or none.
   *
   * INJECTED by `compose-hono-app.ts` rather than imported by the routes that
   * read it, and the reason is a layer boundary. Resolving a mount decodes the
   * embedded preset (`infrastructure/assets/admin-preset.ts`), which is
   * infrastructure; the two routes that consume the answer — the mount's own
   * registration and the URL canonicalizer, which must not rewrite paths inside
   * a mount — are presentation. The composition root is the one place already
   * permitted to hold both, so it resolves once at boot and threads the value,
   * exactly as it already does for `getSession` in the same expression.
   *
   * Resolving ONCE also removes a per-request allocation: the canonicalizer
   * rebuilt its reserved-prefix list on every request through two `use('*')`
   * handlers, for a value that is fixed for the lifetime of the process.
   *
   * Optional, and absent means "no console", which is what the resolver itself
   * returns when `SOVRIUM_ADMIN=off` or the app declares no `admin` key. A
   * caller that wires nothing therefore gets a server with no console — the
   * same visible outcome as switching it off, not a crash and not a
   * half-mounted surface.
   */
  readonly adminMounts?: readonly EmbeddedAppMount[]
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      readonly previewMode?: boolean
      readonly requestQuery?: Readonly<Record<string, string>>
      readonly urlLanguage?: string
      /** G1: scheme + host this request arrived on, feeding `$app.origin`. */
      readonly requestOrigin?: string
      /** G1: the app whose facts `$app.*` prints — the OPERATOR's, under a mount. */
      readonly hostApp?: App
      /** G2: mount base every derived breadcrumb href hangs off. */
      readonly basePath?: string
      /**
       * G3: the server-side rows reader `page.redirectToFirst` resolves its
       * first row through. Its ABSENCE is indistinguishable from an empty
       * collection — the resolver renders the page — so a funnel that has a
       * request and omits it fails silently.
       */
      readonly fetchSystemRows?: (
        endpoint: string,
        rowsKey: string
      ) => Promise<readonly Record<string, unknown>[]>
      /**
       * [internal ref]: the SINGLE-RECORD sibling, for a page-level `{ system }`
       * binding. Unlike the rows reader above, its absence is MEANINGFUL rather
       * than silent: the page falls back to the client-side enhancer marker,
       * because a render with no request has no caller whose 404 it could be.
       */
      readonly fetchSystemRecord?: (
        endpoint: string,
        recordKey: string | undefined
      ) => Promise<Readonly<Record<string, unknown>> | undefined>
      /**
       * P10/mount: the caller's resolved POWERS. A mounted app renders
       * session-less by design, so the capability gates are inert without it.
       * See the port (`page-renderer.ts`) for why the powers travel and the
       * session does not.
       */
      readonly callerCapabilities?: readonly CallerCapability[]
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Returns the RSS 2.0 XML body for the first collection page that
   * declares `rss !== false`, or `undefined` when no such page exists
   * (the route handler responds 404). Optional so a caller that wires no
   * renderer gets a 404 by default rather than a runtime crash.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  readonly getSession?: (headers: Headers) => Promise<SessionInfo | undefined>
}
