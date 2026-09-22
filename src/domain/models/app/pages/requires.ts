/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The capabilities a page may require of the app it is SERVED FOR.
 *
 * ─── WHY THE SET IS CLOSED ─────────────────────────────────────────────────
 *
 * An open string ("require whatever you like") would be a config-time
 * expression language over an app object: unbounded, untestable, and wrong in
 * silence — a typo'd requirement would be permanently unmet and the page would
 * simply never appear, with nothing anywhere saying why. A closed literal set
 * makes the typo a decode error that names every accepted value.
 *
 * Each entry is decidable from an `App` object by one predicate with no I/O
 * (see `domain/models/app/pages/page-requires.ts`). That is the entry criterion: a
 * capability that needed a database read, an env probe or a live request would
 * make page registration depend on runtime state, and a page appearing and
 * disappearing between two requests is worse than one that is simply absent.
 *
 * ─── WHAT "SERVED FOR" MEANS, AND WHY IT IS THE WHOLE POINT ────────────────
 *
 * A standalone app evaluates its own config, where the author already knows
 * what they declared — so `requires` there is close to a comment, and the
 * honest description is *marginal*.
 *
 * An EMBEDDED app is the case this exists for. A console mounted into an
 * operator's app ships pages the operator's config may not support: an API-keys
 * page is meaningless on an instance with no `auth.apiKeys`, and shipping it
 * anyway produces a nav entry that leads to an empty or broken surface. There
 * the requirement is evaluated against the HOST — the operator's app — which is
 * a fact the embedded config cannot otherwise reach.
 *
 * An unmet page is NOT REGISTERED: it 404s, never renders a degraded page, and
 * never appears in the sitemap, in the command palette's page list, or in a
 * derived nav. "Absent" is the only state that is honest about a capability the
 * instance does not have.
 */
export const PAGE_CAPABILITIES = [
  'auth',
  'auth.apiKeys',
  'auth.twoFactor',
  'auth.groups',
  'tables',
  'forms',
  'links',
  'automations',
  'agents',
  'buckets',
  'connections',
  'analytics',
] as const

/** One capability name from the closed set. */
export const PageCapabilitySchema = Schema.Literals([...PAGE_CAPABILITIES]).annotate({
  identifier: 'PageCapability',
  title: 'Page Capability',
  description: 'A capability of the host app that a page requires in order to be served',
})

/** @public */
export type PageCapability = Schema.Schema.Type<typeof PageCapabilitySchema>

/**
 * Every capability a page requires, ALL of which must hold.
 *
 * `AND` rather than `OR` because the alternative has no readable spelling in
 * YAML and no page has yet wanted it: a page needing either of two capabilities
 * is two pages, or one page whose components carry their own `visibility`.
 */
export const PageRequiresSchema = Schema.Array(PageCapabilitySchema)
  .pipe(Schema.check(Schema.isMinLength(1)))
  .annotate({
    identifier: 'PageRequires',
    title: 'Page Requirements',
    description:
      'Capabilities the host app must declare for this page to be registered; an unmet page 404s',
  })

/** @public */
export type PageRequires = Schema.Schema.Type<typeof PageRequiresSchema>
