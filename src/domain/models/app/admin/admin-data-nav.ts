/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure, cross-layer facts about the operator CONSOLE: which app is it, and
 * where do its design-system pages live.
 *
 * ─── WHAT THIS MODULE USED TO BE ───────────────────────────────────────────
 *
 * The Data-tab TAXONOMY — `DATA_NAV_PAGES` and the section vocabulary around it
 * — a list of eleven destinations shared by the hand-written sidebar island and
 * the surface builder that resolved `/_admin/data[/:page]`. Both readers are
 * gone: the builder went with `dashboard-surfaces/`, and the sidebar is now the
 * generic `sidebar` component driven by `src/admin/config/components/sidebar.ts`,
 * where the destinations are AUTHORED alongside the testids and endpoints that
 * belong to them rather than projected from a second list in `src/`.
 *
 * That is the point of the conversion and not an accident of it: a taxonomy in
 * `src/` could only ever be a nav the console renders and no operator's app can.
 * Deleting it removes the second source of truth, not just some code.
 *
 * ─── WHY THE SURVIVORS ARE STILL HERE ──────────────────────────────────────
 *
 * Two facts outlived the taxonomy because they have readers OUTSIDE the nav:
 *
 *  - {@link isOperatorConsoleApp} — the console's identity, asked by the CSS
 *    path builder and by two renderers to keep end-user chrome off it;
 *  - {@link DESIGN_SYSTEM_NAV_CHILDREN} + {@link componentTypePath} — the
 *    console's own addresses, which the GLOBAL SEARCH indexes.
 *
 * It lives in the `admin` slug because that is the feature it describes, and
 * it is pure data + string predicates (no React, no presentation types, no
 * App-config dependency, no I/O), which is what lets a client-side island
 * import it. That purity used to be stated as a `domain/utils` rather than
 * `domain/services` choice; both directories are gone, and the property that
 * mattered was never the directory.
 *
 * NOTE ON THE FILE NAME: `admin-data-nav.ts` no longer describes its contents.
 * Renaming it touches five importers plus its test and was left out of the
 * sidebar swap deliberately, to keep that diff readable. It is a live follow-up,
 * not a considered choice.
 */

/**
 * One child row of a console section: a KNOWN, fixed destination declared here
 * rather than fetched.
 *
 * @see DESIGN_SYSTEM_NAV_CHILDREN — the only remaining instance.
 */
export interface DataNavChild {
  /** Stable key — the row testid suffix under `data-nav-{parent}-{key}`. */
  readonly key: string
  /** English sidebar label for the child row. */
  readonly label: string
  /** The absolute dashboard path the child links to. */
  readonly href: string
}

/**
 * The seven pages of the Design-system console section, in reading order.
 *
 * Tokens, then the components made of them, then the app's own reusable
 * compositions, then the identity and the writing rules that govern both — and
 * finally the exports that hand the whole thing to an agent. The Overview
 * child points at the section root, which IS the Overview page.
 *
 * ─── THE SIDEBAR NO LONGER READS THIS, AND SEARCH STILL DOES ───────────────
 *
 * These seven rows are now AUTHORED a second time, in
 * `src/admin/config/components/sidebar.ts`, where they are written
 * mount-relative like every other console link. Two spellings of one fact is a
 * real cost, and the alternative was measured and refused: deriving the search
 * rows FROM the preset's sidebar would make an application-layer use case read
 * a particular app's authored component tree, and would break the next time the
 * sidebar is restructured for a reason that has nothing to do with search.
 *
 * A six-row constant that search owns is the smaller coupling. What keeps the
 * two honest is `[internal ref]`/`-057` (the sidebar rows) and the
 * `-SEARCH-` block of `global-search.spec.ts` (these), both of which enumerate
 * the same six destinations against a live console.
 *
 * Six, not seven: the `For agents` page was retired into the Overview's own
 * `Share and export` section. Indexing a route that answers 404 puts a dead
 * result in front of a reader who searched for the thing it used to hold.
 *
 * The `href`s here are ABSOLUTE on the default mount, because that is what the
 * search index stores; `rewriteConsoleRootPath` moves them onto whichever mount
 * is serving a given document.
 */
export const DESIGN_SYSTEM_NAV_CHILDREN: ReadonlyArray<DataNavChild> = [
  { key: 'overview', label: 'Overview', href: '/_admin/design-system' },
  { key: 'foundations', label: 'Foundations', href: '/_admin/design-system/foundations' },
  { key: 'ui-kit', label: 'UI kit', href: '/_admin/design-system/ui-kit' },
  { key: 'components', label: 'Components', href: '/_admin/design-system/components' },
  { key: 'brand', label: 'Brand', href: '/_admin/design-system/brand' },
  { key: 'voice', label: 'Voice', href: '/_admin/design-system/voice' },
]

/**
 * One catalogued component type's own page, on the default console mount.
 *
 * ─── THE SEGMENT IS THE TYPE LITERAL, AND SLUGIFYING IT IS THE TRAP ────────
 *
 * The catalogue used to hold camelCase types (`commentCount`, `pageSearch`,
 * `searchInput`), so a kebab-casing guess shipped plausible-looking search rows
 * that 404 when followed. All three were retired by the catalogue merges and
 * none remains — but the rule survives them, because a slugifier is a widening
 * that would resolve a typo onto a real route, and the next camelCase literal
 * would meet it silently. The page itself vouches for
 * its segments through `page.params` over the catalogue, so a wrong spelling is
 * a 404 rather than a rendered page — which is what makes this the one place
 * the address may be composed at all.
 *
 * Here rather than in `search.ts` because it is the same kind of fact as the
 * nav children above it: an address of the console, on the default mount, that
 * more than one reader needs to agree about.
 */
export const componentTypePath = (type: string): string => `/_admin/design-system/ui-kit/${type}`

/**
 * Reserved `name` of the embedded operator-console config. It is authored in
 * `src/admin/app.ts` and frozen into
 * `src/infrastructure/assets/embedded-admin-preset.generated.ts` at build time;
 * the hand-written `dashboard-app.yaml` this used to name is gone. It travels
 * with the binary, never with the operator's app, so it is a stable identity
 * marker — and `src/admin/app.ts` says in as many words that the string must
 * not change, because this predicate is what keys on it.
 */
export const OPERATOR_CONSOLE_APP_NAME = 'sovrium-admin-dashboard'

/**
 * Whether `app` is the `/_admin` operator console rather than a generated app
 * surface.
 *
 * The console is rendered through the SAME page pipeline as any config-driven
 * page — it IS a config-driven app (`src/admin/`, compiled into the binary as a
 * preset) — so keeping end-user chrome off it is NOT structural; it has to be
 * deliberate. The "Built with Sovrium" badge achieves that with `badge: false`
 * in the console's own config; chrome gated on ENV rather than on app config
 * (the demo context notice) has no such config seam and asks this predicate.
 *
 * Identity is matched on the app NAME, not the request path: a mounted console
 * page is `/_admin`-stripped before it renders, so its pages carry
 * ordinary-looking paths (`/`, `/tables/contacts`) indistinguishable from an
 * operator's own. The name travels with the preset onto every console render,
 * including `/login`.
 */
export function isOperatorConsoleApp(app: { readonly name?: string }): boolean {
  return app.name === OPERATOR_CONSOLE_APP_NAME
}
