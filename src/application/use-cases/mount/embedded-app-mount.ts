/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Serving a platform-owned app inside an operator's app, at a fixed base.
 *
 * Exactly one embedded app exists today — Sovrium's operator console — and it
 * is served at exactly one place, `/_admin`, or nowhere. The shape here is
 * still about MOUNTING rather than about the console: a mount is a base path, a
 * preset `App` to serve under it, and the small amount of per-request synthesis
 * that lets a static preset show the operator's live data. Only
 * {@link buildEmbeddedAppMounts} names the base; everything below takes it as
 * an argument, and is a pure function of what it is handed.
 *
 * ─── WHAT A MOUNT IS ───────────────────────────────────────────────────────
 *
 * A base path that owns its whole subtree. `/_admin` answers `/_admin` and
 * every `/_admin/**` path; the operator cannot place a page inside it (that is
 * a boot failure — see `admin-mount-validation.ts`), and the mount is
 * registered ahead of redirect matching and page resolution so it is never
 * shadowed.
 *
 * ─── WHY A LIST OF ZERO OR ONE, AND NOT AN OPTIONAL ────────────────────────
 *
 * `admin` is a boolean, so there is never more than one mount. The list survives
 * because every consumer already iterates it — the route registration, the
 * reserved-prefix derivation, the CSS route's hash lookup — and each of those
 * loops runs zero or one time without a branch. Collapsing to
 * `EmbeddedAppMount | undefined` would trade one shape for a `?.` at each of
 * those call sites and buy nothing.
 *
 * ─── WHY THE PRESET IS PASSED IN ───────────────────────────────────────────
 *
 * The preset is an embedded build artifact, and reading it is an infrastructure
 * concern (`infrastructure/assets/admin-preset.ts`). Taking it as an argument
 * keeps everything here a pure function of already-decoded values, which is
 * what makes a mount testable without a filesystem, a binary, or a server.
 *
 * ─── THE KILL SWITCH WINS ──────────────────────────────────────────────────
 *
 * `SOVRIUM_ADMIN=off` produces zero mounts regardless of what the config
 * declares, and does NOT fail the boot for disagreeing with it. The config is
 * the application's general rule; the environment is the deployment's local
 * override, and an override that refused to start would turn a safety switch
 * into an outage.
 */

import { parseRecordsGridRoute } from '@/application/use-cases/admin/dashboard-surface-routes'
import {
  DEFAULT_ADMIN_MOUNT_PATH,
  mountHref,
  prefixMountHrefs,
} from '@/domain/models/app/admin/mount-hrefs'
import {
  buildDesignSystemScopeApp,
  withOperatorDesignCascade,
} from '@/domain/models/app/design/console-design-cascade'
import { prunePagesByRequirements } from '@/domain/models/app/pages/page-requires'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { withDesignSystemScope } from '@/infrastructure/css/design-system-scope'
import { withMountBasePath } from '@/infrastructure/css/mount-identity'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { SovriumAdminMode } from '@/domain/models/process-env'

/**
 * The console's public sign-in card, relative to whatever mount serves it.
 *
 * Exported because the startup banner PUBLISHES this address: nothing on a
 * Sovrium site links to the console, so the banner is where an operator learns
 * where to sign in — and it must name the same path this module makes public,
 * or it advertises a 404.
 */
export const LOGIN_RELATIVE_PATH = '/login'

/** The password-recovery request form (asks for an address, mails a link). */
const FORGOT_PASSWORD_RELATIVE_PATH = '/forgot-password'

/** The password-recovery completion form (reached from the emailed link). */
const RESET_PASSWORD_RELATIVE_PATH = '/reset-password'

/**
 * Build the mount from a base path, the decoded preset and the operator's app.
 *
 * The operator's app is what the preset's `page.requires` are evaluated
 * AGAINST — an embedded app ships surfaces whose usefulness depends on config
 * it does not own, and an API-keys page on an instance with no API keys is a
 * nav entry leading somewhere empty. An unmet page is dropped from the mount
 * entirely, so it 404s and appears in no listing.
 *
 * ─── WHY THE OPERATOR'S DESIGN IS LAYERED HERE, ONCE, AT BOOT ─────────────
 *
 * The console renders with the operator's declared design tokens ([internal ref] A4 /
 * [internal ref] D4, given a runtime by `[internal ref]`), and `withOperatorDesignCascade` is
 * where that happens. It sits at BOOT rather than per request for the same
 * reason the href rewrite does: the result is a pure function of two immutable
 * inputs, and doing it here means every later consumer — the renderer, the
 * stylesheet hash, and the CSS route rebuilding this app from the operator's —
 * sees one object rather than three constructions that must be kept agreeing.
 *
 * It is applied INSIDE `prefixMountHrefs` only because the href walk does not
 * read `design`; the order between the two is free, and the one that is NOT
 * free is `withMountBasePath` staying OUTERMOST — the mount identity has to
 * survive onto the object the renderer actually hashes, which is the invariant
 * `resolveScopedMountApp` re-establishes by hand after its own spread.
 *
 * ─── NOTHING IS WRITTEN INTO THE PRESET ────────────────────────────────────
 *
 * Every step above returns a fresh object. The preset is a single shared
 * build artifact read once per process, so a step that wrote into it would
 * leak this boot's operator design onto whatever else holds a reference to it.
 */
const buildMount = (presetApp: App, basePath: string, operatorApp: App): EmbeddedAppMount => {
  const at = (relative: string): string => mountHref(basePath, relative)
  return {
    basePath,
    // The preset's own links are authored relative to the mount (`/login`), so
    // they are moved onto this base exactly once, here, at boot. The mount
    // identity rides along because the stylesheet hash is derived from it.
    presetApp: withMountBasePath(
      prefixMountHrefs(
        withOperatorDesignCascade(prunePagesByRequirements(presetApp, operatorApp), operatorApp),
        basePath
      ),
      basePath
    ),
    publicPaths: new Set([
      at(LOGIN_RELATIVE_PATH),
      at(FORGOT_PASSWORD_RELATIVE_PATH),
      at(RESET_PASSWORD_RELATIVE_PATH),
    ]),
    mailGatedPublicPaths: new Set([
      at(FORGOT_PASSWORD_RELATIVE_PATH),
      at(RESET_PASSWORD_RELATIVE_PATH),
    ]),
    signedInRedirectPaths: new Set([at(LOGIN_RELATIVE_PATH), at(FORGOT_PASSWORD_RELATIVE_PATH)]),
    indexable: false,
  }
}

/**
 * The placement of the embedded app for this boot — one mount, or none.
 *
 * `admin` absent or `true` serves the console at {@link DEFAULT_ADMIN_MOUNT_PATH};
 * `admin: false` serves it nowhere, and so does `SOVRIUM_ADMIN=off`, which wins
 * over `admin: true` without failing the boot for the reason the module opens
 * with. This is the only place both are in hand, so it is where they meet.
 *
 * The caller (`admin-mount-setup.ts`) short-circuits on the kill switch a
 * second time, BEFORE it reads the preset. That is not a duplicate of the test
 * here but an independent property: an instance running with the console
 * switched off boots even when the embedded preset is the thing that is broken.
 *
 * @param operatorApp - the operator's decoded config (source of `admin`).
 * @param presetApp - the decoded embedded preset.
 * @param adminMode - the resolved `SOVRIUM_ADMIN` kill switch.
 */
export const buildEmbeddedAppMounts = (
  operatorApp: App,
  presetApp: App,
  adminMode: SovriumAdminMode
): readonly EmbeddedAppMount[] =>
  adminMode === 'off' || operatorApp.admin === false
    ? []
    : [buildMount(presetApp, DEFAULT_ADMIN_MOUNT_PATH, operatorApp)]

/**
 * Per-mount, per-operator-`App` memo of the scoped console app.
 *
 * What the memo has to guarantee is IDENTITY, not merely equality: the page
 * routes and the CSS route both derive a stylesheet hash from this object, and
 * two independently-built results would give the route one identity while the
 * rendered HTML asks for another.
 *
 * Keyed on the mount as well as the operator app even though a boot has at most
 * one mount. The mount is the object whose base path the scoped app is stamped
 * with, so it is the honest key — and a `WeakMap` keyed on it costs nothing and
 * cannot go stale, where a cache keyed only on the operator app would silently
 * return the wrong base if a second mount ever existed again.
 */
const scopedAppCache = new WeakMap<EmbeddedAppMount, WeakMap<App, App>>()

/**
 * The mount's preset, carrying the operator's design system as a SCOPED layer.
 *
 * ─── WHY EVERY SURFACE CARRIES IT, NOT JUST THE DESIGN SECTION ─────────────
 *
 * All of a mount's surfaces share ONE stylesheet identity — a per-surface hash
 * would be unresolvable from a route that sees only a hash. So the scope has to
 * be uniform across the family too: attaching it only to the design-system
 * pages would split the mount into two stylesheet identities, and the CSS route
 * would have to guess which one a given hash meant.
 *
 * The cost is one inert token layer on pages that draw no scope — inert because
 * nothing outside a `[data-design-app-scope]` subtree can match its selector.
 *
 * Returns the SAME object for the same (mount, operator app) pair, so the hash
 * memo and the compile cache both hit on the second request. The CSS route
 * rebuilds it identically, which is what makes the hash the rendered HTML links
 * and the hash the route recognises one construction rather than two that
 * happen to agree.
 */
export const resolveScopedMountApp = (mount: EmbeddedAppMount, operatorApp: App): App => {
  const perMount = scopedAppCache.get(mount) ?? new WeakMap<App, App>()
  const cached = perMount.get(operatorApp)
  if (cached !== undefined) return cached
  const scoped = withDesignSystemScope(mount.presetApp, buildDesignSystemScopeApp(operatorApp))
  // `withDesignSystemScope` spreads, so re-stamp the mount identity: it must
  // survive onto the object the renderer actually hashes.
  const app = withMountBasePath(scoped, mount.basePath)
  // eslint-disable-next-line functional/no-expression-statements -- memoization of a pure derivation over immutable inputs
  perMount.set(operatorApp, app)
  // eslint-disable-next-line functional/no-expression-statements -- memoization of a pure derivation over immutable inputs
  scopedAppCache.set(mount, perMount)
  return app
}

/**
 * What one mounted request resolved to.
 *
 * A tagged union rather than the builder's own `App | DataObjectRedirect |
 * undefined`, so the route layer reads the outcome by its tag instead of
 * re-testing the shape with a type predicate it would have to be handed. The
 * three cases are genuinely different answers — a `Location` header, a page to
 * render, and "this path has no synthesized surface, render the preset page as
 * authored" — and naming them is what keeps the route's branching honest.
 */
export type MountSurfaceOutcome =
  { readonly kind: 'app'; readonly app: App } | { readonly kind: 'none' }

// ─── THERE IS NO `redirect` OUTCOME ANY MORE ────────────────────────────────
//
// A bare object path used to 302 to its first object through a builder result
// that travelled as a bare string the config walk could not see. Every console
// destination is an authored preset page now, and a page states that intent
// itself with `page.redirectToFirst`, resolved on the render path — so a third
// outcome here would be a second mechanism for one behaviour, and the one that
// no producer could reach.

/** Everything one mounted request needs in order to resolve its surface. */
export interface MountSurfaceInput {
  /** The mount serving this request. */
  readonly mount: EmbeddedAppMount
  /** The operator's live config — source of the table schema the surface shows. */
  readonly operatorApp: App
  /** The mount's scoped console app, from {@link resolveScopedMountApp}. */
  readonly scopedApp: App
  /** The request path with the mount's base already stripped. */
  readonly mountPath: string
  /**
   * The caller's resolved session, used ONLY to project the operator table down
   * to the fields they may read.
   *
   * Deliberately not forwarded to `renderPage`: a mounted console page renders
   * session-less today, and handing the renderer a session would additionally
   * switch on page `access` checks, `visibility.roles` and `$user.*` across
   * every console surface at once. That is a change with its own proof; this
   * one is a projection at a single seam.
   */
  readonly session?: SessionInfo
}

/**
 * The operator table an AUTHORED console page binds by route segment, projected
 * to the fields THIS caller may read.
 *
 * Exactly one shape today: the Records explorer at `/tables/:table`, whose grid
 * declares `dataSource.table: $param.table` + `columnsFrom: table`. Both are
 * resolved by `resolveRouteBoundTables` against the RENDERING app's `tables`,
 * which is the console preset's — so the named table has to be merged in or the
 * page answers `'not-found'` for every table the operator actually declares.
 *
 * Returns an empty array for every other path, and for a segment naming no
 * declared table. The second case is deliberately NOT an error here: the
 * renderer already answers it 404, and duplicating that decision would give two
 * places the power to decide what a bad table name means.
 *
 * ─── WHY THE PROJECTION HAPPENS HERE AND NOT DOWNSTREAM ────────────────────
 *
 * `resolveRouteBoundTables` filters derived COLUMNS by field-level read
 * permission, and on this path that filter is INERT: it plans against the
 * rendering app, which is the console preset, and the preset declares no `auth`
 * — so the plan short-circuits to full access and every declared field becomes a
 * column. That alone would be enough to name a restricted field in a grid header
 * the records API then refuses to fill.
 *
 * Filtering the columns downstream would still not be enough, because the field
 * name reaches the document by four independent routes: the derived `columns`,
 * the grid's `tableFields` and `fieldMeta` props, the record-drawer's DERIVED
 * `recordFields`, and the `permissions.fields` entry naming the restriction
 * itself. Each is stamped from the rendering app's table by a different
 * resolver. Projecting the TABLE closes all of them at once, and closes the next
 * one nobody has written yet.
 *
 * Merging the operator's `auth` instead — so the downstream filter could plan
 * correctly — was the other option and is worse: it puts the operator's whole
 * auth configuration into an app it has no other reason to reach, to fix a
 * derivation that is already reachable from here.
 */
/**
 * Whether this path is one the design-system **Components** surface serves.
 *
 * ─── ON THE PATH, AND NOT ON A PARSER'S ANSWER ─────────────────────────────
 *
 * The predicate this replaces asked `parseDesignSystemConsoleRoute(path) ===
 * 'components'`. That parser answers `undefined` for any slug the PRESET serves
 * — the set exists so a flipped page stops being claimed — so the moment
 * Components became config the old gate went permanently false, silently, and
 * the page it exists for would have drawn its `$t:` keys as body text with
 * nothing failing anywhere near the cause.
 *
 * Two shapes, because the surface is two routes: the index, and the sub-route a
 * bookmarkable expanded card lives at. Written out rather than derived from a
 * parser for the reason above — the answer must not depend on who serves the
 * page.
 */
const isComponentsSurfacePath = (mountPath: string): boolean => {
  const segments = mountPath.split('/').filter((segment) => segment.length > 0)
  const [root, page] = segments
  if (root !== 'design-system' || page !== 'components') return false
  // `/design-system/components` and `/design-system/components/:name`, and
  // nothing deeper: a fourth segment names no card and is about to 404.
  return segments.length === 2 || segments.length === 3
}

/**
 * The operator's own reusable templates, on the ONE surface that draws them.
 *
 * ─── WHY A CONFIG PAGE CANNOT SUPPLY THESE ITSELF ──────────────────────────
 *
 * `renderComponentReference` resolves `{ component: name }` against the
 * RENDERING app's `components`, and under a mount that is the console's, which
 * declares none. So a Components page listing the operator's templates draws
 * `Component not found: "site-header" / Available components: none` on the
 * surface whose entire purpose is to show them. The page can name a template; it
 * cannot put one into the app that renders it.
 *
 * This is the sibling of {@link routeBoundOperatorTables} and the second use of
 * the same deliberate seam: the mount is the one place that holds both apps.
 *
 * ─── CONSOLE DEFINITIONS FIRST, AND THAT ORDER IS THE INVARIANT ────────────
 *
 * `renderComponentReference` takes the FIRST match, so the console's own
 * definitions are spread ahead of the operator's at the call site. An operator
 * who names a component after a piece of Sovrium's chrome must not be able to
 * shadow it — the console would then render the operator's template as its own
 * furniture, on a page the operator controls the content of.
 *
 * CONFIG, not data, in the same class as the `design` tokens: a template is a
 * composition the author wrote. `tables`, `env` and `auth` stay behind, so
 * [internal ref] A2's confidentiality bound is untouched.
 */
const routeBoundOperatorComponents = (
  operatorApp: App,
  mountPath: string
): NonNullable<App['components']> =>
  isComponentsSurfacePath(mountPath) ? (operatorApp.components ?? []) : []

/** One language table, as `LanguagesSchema` shapes it: key → string. */
type TranslationTable = Readonly<Record<string, unknown>>

/**
 * The operator's string tables, merged UNDER the console's, on the Components
 * surface only.
 *
 * A real reusable template takes its text from `$t:` lookups, and
 * `resolveTranslation` returns the BARE KEY when it finds no table — so the page
 * drawing those templates printed `nav.services` and `apps.crm.name` as literal
 * body text. Merging the templates without their strings only moves the defect
 * one level in.
 *
 * ─── THE CONSOLE'S OWN TABLE IS NOT REPLACED, AND THAT IS NEW HERE ─────────
 *
 * The builder this moved from could simply overwrite `translations`, because the
 * declaration it started from carried none. The PRESET carries its whole chrome
 * vocabulary there — every sidebar label, every heading, every empty state — so
 * an overwrite would blank the console's own strings and print their keys.
 * Per-code, the console's entries are spread LAST so they win a key collision:
 * the same invariant the component merge keeps by spreading first, said for a
 * map rather than an array. An operator must not be able to repaint Sovrium's
 * furniture by declaring a key the console already uses.
 *
 * ─── WHAT IS DELIBERATELY NOT MERGED ───────────────────────────────────────
 *
 * `default`, `supported` and `detectBrowser` stay the console's, and only tables
 * keyed by a code the console SUPPORTS are taken — read off its own `supported`
 * list rather than hardcoded, so the filter cannot drift from it. A French
 * operator's `fr` table is left behind. That filter also keeps `LanguagesSchema`'s
 * own invariant (`translations` ⊆ `supported`) true of an object that is never
 * re-decoded and so has nothing else to hold it honest.
 *
 * `undefined` — merge nothing — for every other path, for an operator with no
 * `languages`, and for one whose tables share no code with the console. No
 * throw, nothing repainted.
 */
const declaredTables = (app: App): Readonly<Record<string, TranslationTable>> | undefined => {
  const declared = app.languages?.translations
  return typeof declared !== 'object' || declared === null || Array.isArray(declared)
    ? undefined
    : (declared as Readonly<Record<string, TranslationTable>>)
}

const consoleLanguagesForPath = (
  operatorApp: App,
  scopedApp: App,
  mountPath: string
): App['languages'] | undefined => {
  if (!isComponentsSurfacePath(mountPath)) return undefined
  const declared = declaredTables(operatorApp)
  if (declared === undefined) return undefined

  const consoleLanguages = scopedApp.languages
  const admitted = new Set((consoleLanguages?.supported ?? []).map((language) => language.code))
  const consoleTables = declaredTables(scopedApp) ?? {}
  const borrowed = Object.entries(declared).filter(([code]) => admitted.has(code))
  if (borrowed.length === 0) return undefined

  const translations = Object.fromEntries(
    borrowed.map(([code, table]) => [code, { ...table, ...(consoleTables[code] ?? {}) }] as const)
  )
  return {
    ...consoleLanguages,
    translations: { ...consoleTables, ...translations },
  } as App['languages']
}

const routeBoundOperatorTables = (
  operatorApp: App,
  mountPath: string,
  session: SessionInfo | undefined
): NonNullable<App['tables']> => {
  const tableName = parseRecordsGridRoute(mountPath)
  if (tableName === undefined) return []
  const table = (operatorApp.tables ?? []).find((declared) => declared.name === tableName)
  if (table === undefined) return []
  const projected = readableTableProjection(operatorApp, table, session)
  return projected ? [projected] : []
}

/**
 * One operator table with every field this caller may not read removed —
 * including from the `permissions.fields` entry that named the restriction.
 *
 * `undefined` when the caller may not read the table at all, or when nothing of
 * it is readable. The mount then merges nothing, the route-bound resolver finds
 * no declared table of that name, and the page answers 404 — the same answer an
 * unknown table gets, which is the anti-enumeration posture the rest of the
 * console already takes (S1).
 *
 * An app with no `auth` is the full-access model, matching every other read gate
 * in the codebase. It is also unreachable in practice: a console caller with no
 * session is 404ed before a surface is ever synthesised.
 */
const readableTableProjection = (
  operatorApp: App,
  table: NonNullable<App['tables']>[number],
  session: SessionInfo | undefined
): NonNullable<App['tables']>[number] | undefined => {
  if (!operatorApp.auth) return table

  const plan = buildReadAccessPlan({
    app: operatorApp,
    table: table as TableLike,
    principal: readPrincipalFromSession(session),
    policy: CANONICAL_READ_POLICY,
    // No `rowContext`: `restrictedColumns` is computed from FIELD permissions
    // alone and never consults it — only `rowPredicate` does, and this
    // projection does not read that. Supplying one would imply a row decision
    // is being made here, which it is not.
  })
  if (!plan.allowed) return undefined

  const fields = table.fields.filter((field) => !plan.restrictedColumns.has(field.name))
  if (fields.length === 0) return undefined
  if (fields.length === table.fields.length) return table

  const { permissions } = table
  const scopedPermissions =
    permissions?.fields === undefined
      ? permissions
      : {
          ...permissions,
          fields: permissions.fields.filter((entry) => !plan.restrictedColumns.has(entry.field)),
        }

  return {
    ...table,
    fields,
    ...(scopedPermissions === undefined ? {} : { permissions: scopedPermissions }),
  } as NonNullable<App['tables']>[number]
}

/**
 * Synthesize the surface for one request into a mount.
 *
 * It used to delegate the per-path composition to `buildDashboardSurfaceApp`
 * and then re-point the absolute console links that builder's surfaces wrote.
 * Both halves are gone. Every console path is an authored preset page matched
 * by the ordinary page router, and a preset page's links are mount-relative and
 * were moved onto this mount's base once, at boot (`buildMount`) — so there is
 * no second rewrite to perform here, and the note that this step "goes away
 * when those builders become config" has come true.
 *
 * What remains is narrower and is spelled out in the body: the three places a
 * preset page needs something only the mount holds. An ordinary console page
 * takes the `none` branch and renders from the preset alone.
 *
 * ─── THE ONE PLACE THE MOUNT KNOWS THE OPERATOR'S SCHEMA ───────────────────
 *
 * A config page cannot inject an operator TABLE into the app that renders it,
 * and the Records grid needs one: `table` resolves columns, field meta and
 * permissions from the RENDERING app's `tables`, so `/tables/contacts` renders
 * no columns unless `contacts` is present there. `columnsFrom: table` and the
 * route-bound `dataSource.table: $param.table` both read the SAME list, so
 * without the merge the page answers 404 for every table the operator declares.
 *
 * That merge is {@link routeBoundOperatorTables}, and it is the deliberate seam
 * — the single place the mount is allowed to look at the operator's schema
 * rather than only at its config. It moved here from
 * `buildDashboardSurfaceApp` when the Records page became config: the builder
 * that used to need it is gone, and this is now the only path that serves
 * `/tables/:table`.
 *
 * ─── WHY ONE TABLE AND NOT ALL OF THEM ─────────────────────────────────────
 *
 * The console is admin-tier only, so the operator's tables ARE its data by
 * definition ([internal ref] D1) and carrying them is not a disclosure decision. It is
 * still scoped to the ONE table the URL names, for two reasons that are not
 * about access: field-level read permissions are applied per table by
 * `resolveRouteBoundTables`, so a table nobody asked for would be resolved for
 * nothing; and `table` picks its columns out of the rendering app's
 * `tables`, so a second declaration named like a console table could shadow it.
 * The narrow merge keeps both questions unaskable.
 *
 * @param input - the mount, both apps, the stripped path, and the request state.
 */
export const synthesiseMountSurface = async (
  input: MountSurfaceInput
): Promise<MountSurfaceOutcome> => {
  const { operatorApp, scopedApp, mountPath } = input
  // EVERY console path is an authored preset page now, matched by the ordinary
  // page router. What is left here is not routing: it is the three narrow places
  // a preset page needs something only the mount holds, because a config page
  // can NAME the operator's schema but cannot inject it into the app that
  // renders it.
  //
  // `routeBoundOperatorTables` answers an empty array for every path but
  // `/tables/:table`, and the two below for every path but the Components
  // surface — so an ordinary console page takes the `none` branch untouched and
  // renders from the preset alone.
  //
  // NOT re-pointed through `rewriteConsoleRootHrefs`: a preset page's links were
  // moved onto this mount's base once, at boot (`buildMount`). Walking them
  // again here would be a second rewrite of already-correct hrefs, and would
  // additionally walk the operator's own table declarations.
  const tables = routeBoundOperatorTables(operatorApp, mountPath, input.session)
  const components = routeBoundOperatorComponents(operatorApp, mountPath)
  const languages = consoleLanguagesForPath(operatorApp, scopedApp, mountPath)
  if (tables.length === 0 && components.length === 0 && languages === undefined) {
    return { kind: 'none' }
  }
  return {
    kind: 'app',
    app: {
      ...scopedApp,
      ...(tables.length === 0 ? {} : { tables: [...(scopedApp.tables ?? []), ...tables] }),
      ...(components.length === 0
        ? {}
        : { components: [...(scopedApp.components ?? []), ...components] }),
      ...(languages === undefined ? {} : { languages }),
    } as App,
  }
}
