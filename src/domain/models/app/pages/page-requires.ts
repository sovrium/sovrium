/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { analyticsIsEnabled } from '@/domain/models/app/analytics/analytics-enabled'
import type { App } from '@/domain/models/app'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * Whether a host app declares one capability.
 *
 * Every predicate is a plain read of the decoded `App` — no I/O, no env, no
 * database. That is what makes page registration a boot-time decision rather
 * than a per-request one, and it is why {@link PAGE_CAPABILITIES} is closed to
 * exactly the names answerable this way.
 *
 * An empty declaration counts as ABSENT (`tables: []` is not "this instance has
 * tables"), because the pages this gates exist to operate on the things
 * declared, and there are none.
 *
 * By the same reading, an explicit `false` counts as absent too. `auth.apiKeys`
 * is a plain `Schema.Boolean`, so `apiKeys: false` is a config an operator can
 * write, and it means the plugin is NOT mounted — every `/api/auth/api-key/*`
 * endpoint answers 404. A `!== undefined` test would have served the API-keys
 * page to exactly that instance: a page whose every control calls a route that
 * is not there. `=== true` is what makes "declared" mean "enabled", and it is
 * the behaviour the hand-written builder gate this replaced already had
 * (`operatorApp.auth?.apiKeys !== true` → no surface). `auth.twoFactor` takes
 * the same shape for the same reason — its schema is `Boolean | Struct`, so
 * only the literal `false` is excluded and an options object still counts.
 */
const CAPABILITY_PREDICATES: Readonly<Record<PageCapability, (app: App) => boolean>> = {
  auth: (app) => app.auth !== undefined,
  'auth.apiKeys': (app) => app.auth?.apiKeys === true,
  'auth.twoFactor': (app) => app.auth?.twoFactor !== undefined && app.auth.twoFactor !== false,
  'auth.groups': (app) => (app.auth?.groups?.length ?? 0) > 0,
  tables: (app) => (app.tables?.length ?? 0) > 0,
  forms: (app) => (app.forms?.length ?? 0) > 0,
  links: (app) => (app.links?.length ?? 0) > 0,
  automations: (app) => (app.automations?.length ?? 0) > 0,
  agents: (app) => (app.agents?.length ?? 0) > 0,
  buckets: (app) => (app.buckets?.length ?? 0) > 0,
  connections: (app) => (app.connections?.length ?? 0) > 0,
  // [internal ref]: `!== undefined` here served the page to an instance whose every
  // analytics endpoint 404s. The shared predicate is the one `api-routes.ts`
  // gates those endpoints on, `false` included.
  analytics: analyticsIsEnabled,
}

/**
 * Whether a host app declares a capability.
 *
 * @param app - the app the page is SERVED FOR: the operator's app for a mounted
 *   embedded app, the app itself when it is served standalone.
 */
export const isCapabilityMet = (app: App, capability: PageCapability): boolean =>
  CAPABILITY_PREDICATES[capability](app)

/**
 * Whether every capability a page requires holds for its host app.
 *
 * A page with no `requires` is always served — the key is opt-in, so no
 * existing page changes behaviour.
 *
 * `every` on an empty list is `true`, but the schema already refuses an empty
 * `requires`, so that case cannot reach here from a decoded config.
 *
 * @param app - the app the page is SERVED FOR (see {@link isCapabilityMet}).
 * @param requires - the page's declared requirements, if any.
 */
export const pageRequirementsMet = (
  app: App,
  requires: readonly PageCapability[] | undefined
): boolean => requires === undefined || requires.every((one) => isCapabilityMet(app, one))

/**
 * Drop every page whose requirements the host does not meet.
 *
 * ─── WHY DROPPING, RATHER THAN GATING PER REQUEST ──────────────────────────
 *
 * The property `requires` must have is ABSENCE, not degradation: an unmet page
 * 404s, appears in no sitemap, in no command-palette page list and in no
 * derived navigation — the same state as a page nobody wrote. A per-request
 * check in the route layer would deliver the 404 and none of the rest, leaving
 * the app advertising URLs it refuses to serve.
 *
 * Every predicate reads the decoded config with no I/O, so the decision is a
 * boot-time one and a page cannot appear and disappear between two requests.
 *
 * Returns the SAME object when nothing is dropped, so an app with no `requires`
 * anywhere — which is every app that has not opted in — pays one `every` over
 * its pages and no copy at all.
 *
 * @param app - the app whose pages are being filtered.
 * @param hostApp - the app the requirements are evaluated AGAINST. For a
 *   mounted embedded app that is the OPERATOR's config, which is the fact the
 *   embedded app cannot otherwise reach; for a standalone app it is `app`.
 */
export const prunePagesByRequirements = <T extends App>(app: T, hostApp: App = app): T => {
  const { pages } = app
  if (pages === undefined) return app
  const kept = pages.filter((page) => pageRequirementsMet(hostApp, page.requires))
  return kept.length === pages.length ? app : { ...app, pages: kept }
}
