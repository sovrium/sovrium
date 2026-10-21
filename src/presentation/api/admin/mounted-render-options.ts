/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getCookie } from 'hono/cookie'
import {
  LANGUAGE_PREFERENCE_COOKIE,
  resolvePreferredLanguage,
} from '@/domain/models/app/languages/language-detection'
import {
  grantedCallerCapabilities,
  viewerIdentityOf,
} from '@/domain/models/app/pages/component-session-visibility-service'
import { callerFieldReaderOf } from '@/domain/models/app/tables/field-read-filter-service'
import { logError } from '@/infrastructure/logging/logger'
import { stampRequestId } from '@/presentation/render/page/render-error-pages'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
import {
  systemRecordFetcher,
  systemRowsFetcher,
} from '../../../infrastructure/egress/system-rows-fetcher'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Context } from 'hono'

/** The options `config.renderPage` takes, as a mounted page passes them. */
export type MountedRenderOptions = NonNullable<Parameters<HonoAppConfig['renderPage']>[2]>

/**
 * The operator's language against the MOUNTED app's `languages.supported`:
 * account, then this browser's cookie. Derived here: a mounted page renders
 * session-less.
 */
export const mountedPreferredLanguage = (
  scopedApp: App,
  session: SessionInfo | undefined,
  c: Context
): string | undefined =>
  resolvePreferredLanguage(scopedApp.languages, session?.language) ??
  resolvePreferredLanguage(scopedApp.languages, getCookie(c, LANGUAGE_PREFERENCE_COOKIE))

/** Everything a mounted page's render options are derived from. */
export interface MountedRenderOptionsInput {
  readonly mount: EmbeddedAppMount
  readonly config: HonoAppConfig
  readonly c: Context
  /** The caller's session — absent only on the public carve-out. */
  readonly session: SessionInfo | undefined
  readonly preferredLanguage: string | undefined
}

/**
 * The options every page of a mount is rendered with.
 *
 * P10: the caller's POWERS (`callerCapabilities`), and her role and groups for
 * her record sheet's field access — never her session. The capabilities are
 * the closed vocabulary the domain's own `grantedCallerCapabilities` derives
 * from the predicates the admin-route guards apply (`isAdminTier`,
 * `isAdminEquivalent`, `canEditOperations`), so a drawn control and an
 * admitted write agree. A capability set cannot be read as a role, cannot
 * resolve `$user.*`, and cannot reach a row filter; the anonymous public
 * carve-out holds no session and is given nothing. Her id and email travel
 * too (`viewerIdentity`), answering a `$user.id` / `$user.email` condition and
 * nothing else.
 */
export const mountedRenderOptions = ({
  mount,
  config,
  c,
  session,
  preferredLanguage,
}: MountedRenderOptionsInput): MountedRenderOptions => ({
  requestQuery: c.req.query(),
  requestOrigin: resolveRequestBaseUrl(c),
  // The browser's cookies, as unmounted routes pass them (a folded sidebar).
  cookies: getCookie(c),
  // The operator's persisted language, resolved against the MOUNTED app's own
  // `languages.supported` — never the operator's. A mount is a second app on
  // the operator's origin and one browser carries one preference, so the
  // clamp is what keeps a console that declares `en`/`fr` from being served
  // `lang="es-ES"` over English strings.
  //
  // Threaded as `urlLanguage` because that is the rank it needs: every preset
  // page pins `meta.lang`, and a preference entering BELOW that pin would be
  // inert, silently. `undefined` leaves the pin deciding, which is the right
  // answer for an operator who has chosen nothing
  ...(preferredLanguage ? { urlLanguage: preferredLanguage } : {}),
  // G1: a mounted console prints the OPERATOR's name and version, never the
  // preset's own — which is the fact its config cannot reach.
  hostApp: config.app,
  // G2: the crumbs derive from the STRIPPED path, so their hrefs hang off the
  // mount rather than off the operator's own root.
  basePath: mount.basePath,
  // G3: the server-side rows reader, WITHOUT which `page.redirectToFirst` is
  // inert on a mount — and inert SILENTLY. `resolveFirstObjectRedirect`
  // degrades an absent fetcher to "no first row", which is the same answer as
  // an empty collection, so a console page that should 302 to its first
  // object just rendered its own empty state instead.
  //
  // A mounted app does not pass through `renderWithCache`, which is where the
  // operator page funnel builds this. Both funnels now call the ONE
  // constructor rather than each carrying the borrowed-identity header list.
  fetchSystemRows: systemRowsFetcher(c),
  // The SINGLE-RECORD sibling. A page bound to a `{ system }`
  // detail endpoint is NAMED by its record, so it must be read before the
  // document ships — as the caller, and 404ing when there is none.
  fetchSystemRecord: systemRecordFetcher(c),
  callerCapabilities: grantedCallerCapabilities(session, config.app),
  callerFieldReader: callerFieldReaderOf(session),
  // The reader's IDENTITY — id and email, never her role, groups or session —
  // so a `$user.email neq $param.email` gate can tell her own account page.
  viewerIdentity: viewerIdentityOf(session),
})

/** The console page a failed render draws, and only a failed render: its own address is missing. */
export const INTERNAL_ERROR_PATH = '/500'

/**
 * The document a mounted render that failed answers with.
 *
 * An operator the console admits gets its own `/500`, drawn like any of its
 * pages — shell, crumbs and language included — with the request id stamped
 * in its `<head>` for its report. Anyone else — an anonymous caller or a
 * signed-in member on the public sign-in and recovery pages, which hold a
 * session but no console access — a console declaring no `/500`, or a `/500`
 * that cannot draw either, gets the bare default error page naming the id: no
 * console chrome for a caller the console does not admit (S1), and never the
 * operator's own `/500` either, since the failure was the console's.
 */
export const renderMountedErrorPage = async (
  input: MountedRenderOptionsInput & { readonly scopedApp: App; readonly hasAccess: boolean },
  requestId: string | undefined
): Promise<string> => {
  const { config, scopedApp, hasAccess, preferredLanguage } = input
  const page = hasAccess ? await drawConsoleErrorPage(input, scopedApp) : undefined
  return typeof page === 'string'
    ? stampRequestId(page, requestId)
    : config.renderErrorPage(undefined, preferredLanguage, requestId)
}

/**
 * The console's `/500`, or `undefined` when it cannot draw either. Not
 * swallowed silently: the failure is logged, and the caller still answers the
 * ORIGINAL failure, under its own id, with the bare error page.
 */
const drawConsoleErrorPage = async (
  input: MountedRenderOptionsInput,
  scopedApp: App
): Promise<PageRenderResult> => {
  try {
    return await input.config.renderPage(
      scopedApp,
      INTERNAL_ERROR_PATH,
      mountedRenderOptions(input)
    )
  } catch (error) {
    logError('[server] the console error page could not draw; answering the bare one', error)
    return undefined
  }
}
