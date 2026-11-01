/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The auth half of the page render gate: who the caller is, what the app's
 * `auth` block actually configures, and where a request is sent before
 * anything renders.
 *
 * Four concerns that share one question — "does this request get this page,
 * and as whom?" — and therefore one file:
 *
 *  - the `user_access` role overlay, which decides what the session IS;
 *  - the two strip passes, which remove auth affordances the app never
 *    configured (an unconfigured OAuth button is a dead end, not a feature);
 *  - the access-decision translation, which turns a `checkPageAccess` verdict
 *    into a render result;
 *  - the two pre-render redirects, which answer the request without rendering.
 *
 * Split from its CRUD sibling (`page-crud-gating.tsx`) because the two read
 * different declarations and together exceeded the tree's file ceiling.
 */

import { resolveLandingPath } from '@/domain/models/app/pages/landing-resolver'
import { isCapabilityMet, passwordResetRequestPath } from '@/domain/models/app/pages/page-requires'
import { isOutgoingEmailConfigured } from '@/domain/models/process-env/email-transport'
import { servingMountHref } from '@/presentation/render/resolve/auth-form-facts-stamp'
import {
  componentField,
  entryAsComponent,
  keyOf,
  rewriteComponent,
  type ComponentEntry,
} from '@/presentation/render/resolve/component-rewrite'
import { resolveFirstObjectRedirect } from '@/presentation/render/resolve/first-object-redirect-resolver'
import { hideComponent } from './page-crud-gating'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { AccessDecision } from '@/domain/models/app/pages/page-access-check'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/**
 * No-op database adapter used when no db dependency is provided.
 * Returns empty results — pages without dataSource bindings are unaffected.
 */
export const noopDb: DataSourceDb = {
  fetchRecords: async () => [],
  countRecords: async () => 0,
  fetchSingleRecord: async () => undefined,
  // Fails closed: no `user_access` reader means no assignments, so an
  // assignment filter matches nothing rather than trusting a cookie.
  fetchUserAssignments: async () => [],
  // Fails closed too: with no reader of the records list, no row is listed.
  readReaderRows: async () => ({ admission: { kind: 'no-row' }, grants: new Map() }),
}

/**
 * [internal ref] / a pages collection spec: overlay user_access roles onto the
 * session. Mirrors `mergeRoles` in `row-level-guard.ts`. Always returns a
 * fresh SessionInfo with `effectiveRoles` populated (deduped union of the
 * Better Auth role + all user_access roles); the original `role` field is
 * preserved so downstream code that keys on it (analytics, etc.) is
 * unaffected. Errors from the db adapter (missing table, etc.) are absorbed
 * — the overlay degrades to "just the Better Auth role" silently.
 */
async function overlayUserAccessRoles(
  session: SessionInfo,
  db: DataSourceDb
): Promise<SessionInfo> {
  if (!db.fetchUserAccessRoles) return session
  const extras = await db.fetchUserAccessRoles(session.userId).catch(() => [] as readonly string[])
  if (extras.length === 0) return session
  const merged = [...new Set<string>([session.role, ...extras])]
  return { ...session, effectiveRoles: merged }
}

/**
 * [internal ref] / a pages collection spec: overlay `system.user_access` roles
 * onto the request session before any access check fires, mirroring the
 * table-level Z-3 pattern in `row-level-guard.ts`. A user with Better
 * Auth role `member` but a `user_access` row of `role: 'engineer'`
 * passes a page guard of `access: ['engineer']`. The overlay only fires
 * when both the db adapter AND the session are present so anonymous
 * requests stay on the existing path. Extracted from `renderPageByPath`
 * to keep that function under the max-lines-per-function cap.
 */
export async function resolveOverlayedSession(
  rawSession: SessionInfo | undefined,
  db: DataSourceDb | undefined
): Promise<SessionInfo | undefined> {
  if (!rawSession) return undefined
  return overlayUserAccessRoles(rawSession, db ?? noopDb)
}

// ─── Auth action stripping ──────────────────────────────────────────────────

/**
 * Strips auth actions from form components when auth is not configured.
 * This ensures auth forms render as empty (hidden) when the app has no auth strategies.
 */
export function stripAuthActionsIfUnconfigured(
  components: Page['components'],
  hasAuth: boolean
): Page['components'] {
  if (hasAuth || !components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const component = entryAsComponent(item)
    if (keyOf(componentField(component, 'action'), 'type') === 'auth') {
      return hideComponent(component)
    }
    return component
  })
}

/** The sign-in strategies that draw no email field: a passkey, a provider, single sign-on. */
const FIELDLESS_STRATEGIES: ReadonlySet<string> = new Set(['passkey', 'oauth', 'sso'])

/** Whether a node is a sign-in form whose email field a passkey can fill. */
const isEmailSignIn = (component: Component): boolean => {
  const action = componentField(component, 'action')
  const strategy = keyOf(action, 'strategy')
  return (
    keyOf(action, 'type') === 'auth' &&
    (keyOf(action, 'method') ?? 'login') === 'login' &&
    !FIELDLESS_STRATEGIES.has(typeof strategy === 'string' ? strategy : '')
  )
}

/**
 * The address of the app's password-reset request page, under the mount serving
 * it — only while this instance can send mail, the same check the sign-in
 * refusal makes: a link to a reset page whose email never leaves is a dead end.
 */
function recoveryHrefOf(app: App): string | undefined {
  if (!isOutgoingEmailConfigured(process.env)) return undefined
  const path = passwordResetRequestPath(app)
  return path === undefined ? undefined : servingMountHref(app, path)
}

/**
 * Marks every email sign-in form, at any depth, with what the app around it
 * offers: passkeys, so its email field asks the browser for passkey autofill
 * (`username webauthn`); a password-reset request page and outgoing mail, so
 * its Password label row links there ("Forgot your password?"). The marks ride the action — the
 * auth-form renderer is the one reader — and an app offering neither gets its
 * tree back untouched.
 */
export function markSignInForms(components: Page['components'], app: App): Page['components'] {
  const passkeys = isCapabilityMet(app, 'auth.passkeys')
  const recoveryHref = recoveryHrefOf(app)
  if (!components || (!passkeys && recoveryHref === undefined)) return components
  const marks = {
    ...(passkeys && { _passkeyAutofill: true }),
    ...(recoveryHref !== undefined && { _recoveryHref: recoveryHref }),
  }
  const mark = (component: Component): Component => {
    const children = component.children?.map((child: ComponentEntry) =>
      typeof child === 'string' || 'component' in child || '$ref' in child
        ? child
        : mark(entryAsComponent(child))
    )
    const marked = isEmailSignIn(component)
      ? rewriteComponent(component, {
          action: { ...componentField(component, 'action'), ...marks },
        })
      : component
    return children === undefined ? marked : rewriteComponent(marked, { children })
  }
  return components.map((item) =>
    'component' in item || '$ref' in item ? item : mark(entryAsComponent(item))
  )
}

/**
 * Strips OAuth form components when the requested OAuth provider is not configured
 * in auth strategies. This prevents OAuth forms from rendering when the provider
 * is not available.
 */
export function stripUnconfiguredOAuthForms(
  components: Page['components'],
  app: App
): Page['components'] {
  if (!components) return components

  const oauthStrategy = app.auth?.strategies?.find((s) => s.type === 'oauth') as
    { readonly type: 'oauth'; readonly providers: readonly string[] } | undefined
  const configuredProviders = oauthStrategy?.providers ?? []

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const component = entryAsComponent(item)
    const action = componentField(component, 'action')
    if (keyOf(action, 'type') !== 'auth' || keyOf(action, 'strategy') !== 'oauth') return component

    // If provider is not in configured providers, hide the component
    const provider = keyOf(action, 'provider')
    if (typeof provider !== 'string' || !provider || !configuredProviders.includes(provider)) {
      return hideComponent(component)
    }

    return component
  })
}

/**
 * Converts an AccessDecision into a denial result (redirect, error, or undefined for 404).
 * Returns false if the page is allowed (access granted). A denial's redirect is
 * the access rule sending a signed-out visitor to sign in, and says so.
 */
export function toAccessDeniedResult(decision: AccessDecision): PageRenderResult | false {
  if (decision.allowed) return false
  if (decision.action === 'redirect') return { redirect: decision.url, signIn: true }
  if (decision.action === 'error') return { error: decision.message }
  return undefined // 'not-found' → 404
}

/**
 * Resolves the post-login landing redirect for an authenticated session
 * navigating to `auth.landingPath`. Returns a `redirect` result when the
 * resolver picks a different URL, or `undefined` to fall through to normal
 * page rendering (the access guard already bounced anonymous visitors).
 */
async function resolveLandingRedirect(
  app: App,
  path: string,
  session: SessionInfo | undefined,
  db: DataSourceDb | undefined
): Promise<PageRenderResult | undefined> {
  if (
    session === undefined ||
    app.auth?.landingPath === undefined ||
    app.auth.landingPath !== path
  ) {
    return undefined
  }
  const fetchAssignments = (db ?? noopDb).fetchUserAssignments
  const target = await resolveLandingPath(app, session, fetchAssignments)
  return target === path ? undefined : { redirect: target }
}

/**
 * The redirects decided before a page renders, in precedence order.
 *
 * 1. The post-login landing target — it fires only for the configured
 *    `auth.landingPath`, and only after the access guard has already bounced
 *    anonymous visitors.
 * 2. `page.redirectToFirst` — a bare collection path answers with its first
 *    object. Evaluated here, before any rendering, because the whole point is
 *    NOT to render this page. An empty collection resolves nothing and falls
 *    through to the normal render, so the operator sees the page's own empty
 *    state rather than a 302 to a path that does not exist.
 *
 * Returns `undefined` when the request should render normally.
 */
export async function resolvePreRenderRedirect(input: {
  readonly app: App
  readonly path: string
  readonly page: Page
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb | undefined
  readonly fetchSystemRows?: SystemRowsFetcher
}): Promise<PageRenderResult | undefined> {
  const { app, path, page, session, db, fetchSystemRows } = input
  const landing = await resolveLandingRedirect(app, path, session, db)
  if (landing !== undefined) return landing

  const firstObject = await resolveFirstObjectRedirect(page, {
    app,
    session,
    db: db ?? noopDb,
    ...(fetchSystemRows !== undefined ? { fetchSystemRows } : {}),
  })
  return firstObject !== undefined ? { redirect: firstObject } : undefined
}
