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
  // The sign-in ways and sign-up, so a library block draws only the
  // alternatives the app configured: a strategy the app does not offer is
  // absent from the page, never a dead button
  'auth.passkeys',
  'auth.magicLink',
  'auth.oauth',
  'auth.sso',
  'auth.signUp',
  // A way back in for a reader who forgot the password: the email-and-password
  // strategy, AND a page of the app drawing the form that asks for a reset
  // link. A "Forgot password?" link gated on it never leads to a page that is
  // not there
  'auth.passwordReset',
  // Records whose readers are limited to the accounts granted them
  // (`auth.scopeTables`). The one capability that can be asked about ONE
  // table: where the gated thing is bound to a table, it holds only when THAT
  // table is listed, so an affordance about grants is offered on a scoped
  // table's record and on no other. Anywhere no table is bound — a page's
  // `requires`, a component with no `dataSource.table` — it holds when the app
  // lists at least one. See `CAPABILITY_PREDICATES` for the exact reading
  'auth.scopeTables',
  'tables',
  'forms',
  'links',
  'automations',
  'agents',
  'buckets',
  'connections',
  'analytics',
  // The app records why its config is the way it is (`decisions`)
  'decisions',
  // The app serves at least one page of its own. A host with none has no
  // audience to measure, so an analytics surface draws only what the instance
  // itself spends
  'pages',
  // The app declares at least one reusable component template (`components`)
  'components',
  // The app ships at least one template asset — an `assets` entry whose kind
  // is html, svg, partial, text, docx, xlsx or pptx — which is what a template
  // preview has to render. A font, an image or a data file is not a template
  'assets.templates',
  // The identity half of `design`: a logo, colour roles, imagery, principles or
  // a zone map. Tokens alone (colours, type, radius) are not a brand
  'design.brand',
  // How the app sounds (`design.voice`)
  'design.voice',
  // The app stores something whose readers can be granted: at least one table,
  // form or bucket. `requires` is AND, so a page needing "any of the three"
  // names this one capability instead of three pages
  'data',
] as const

/** One capability name from the closed set. */
export const PageCapabilitySchema = Schema.Literals([...PAGE_CAPABILITIES]).annotate({
  identifier: 'PageCapability',
  title: 'Page Capability',
  // POLARITY-NEUTRAL ON PURPOSE. One node serves `pages[].requires`,
  // `visibility.declares` AND `visibility.unlessDeclares`, and it carries an
  // `identifier`, so annotating it at a use site would FORK its `$def`. A
  // sentence written for the positive polarity therefore reached the negative
  // key too and told that reader the opposite of what the key does. The
  // direction belongs to the key name; this says only what the VALUE is.
  description:
    'A capability of the host app — a feature its own config declares — named by a page requirement or by a component visibility gate',
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
