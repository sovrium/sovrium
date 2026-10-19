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
  consoleLanguagesForPath,
  routeBoundOperatorComponents,
} from '@/application/use-cases/mount/components-surface-merge'
import {
  DEFAULT_ADMIN_MOUNT_PATH,
  mountHref,
  prefixMountHrefs,
} from '@/domain/models/app/admin/mount-hrefs'
import { consoleTableView } from '@/domain/models/app/auth/console-table-view-service'
import {
  buildDesignSystemScopeApp,
  withOperatorDesignCascade,
} from '@/domain/models/app/design/console-design-cascade'
import { withOperatorLocales } from '@/domain/models/app/languages/console-locale-service'
import { consoleLabelTranslators } from '@/domain/models/app/languages/translation-resolver'
import { mountedInvitationPages } from '@/domain/models/app/pages/invitation-link-service'
import { prunePagesByRequirements } from '@/domain/models/app/pages/page-requires'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { relatedFieldsWithheldFrom } from '@/domain/models/app/tables/lookup-link-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
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

/** A thunk answering ONE value, computed on first call (the stylesheet hash needs one object). */
const memoizeOnce = <T>(compute: () => T): (() => T) => {
  const cell = new Map<'value', T>()
  // eslint-disable-next-line functional/immutable-data -- memoization of a pure derivation over immutable inputs
  return () => cell.get('value') ?? (cell.set('value', compute()).get('value') as T)
}

/**
 * Build the mount from a base path, the preset (read on first use) and the operator's app.
 *
 * The operator's app is what the preset's `page.requires` are evaluated
 * AGAINST: an unmet page is dropped from the mount, so it 404s and appears in
 * no listing. The operator's design tokens and language regions are layered here
 * too, once, so the renderer, the stylesheet hash and the CSS route all see one
 * object. `withMountBasePath` stays OUTERMOST: the mount identity has to survive
 * onto the object the renderer hashes (`resolveScopedMountApp` re-stamps it after
 * its own spread). No step writes into the shared preset.
 *
 * The preset is read on the first access to `presetApp` (or `publicPaths`,
 * which lists its invitation pages), never while the mount is built: decoding
 * the console is a sixth of a cold start, and what registration and the
 * startup banner read (`basePath`, the two fixed path sets) needs none of it.
 */
const buildMount = (
  resolvePreset: () => App,
  basePath: string,
  operatorApp: App
): EmbeddedAppMount => {
  const at = (relative: string): string => mountHref(basePath, relative)
  // The preset's links are authored relative to the mount (`/login`); they move
  // onto this base exactly once, here.
  const presetApp = memoizeOnce(() =>
    withMountBasePath(
      prefixMountHrefs(
        withOperatorDesignCascade(
          withOperatorLocales(prunePagesByRequirements(resolvePreset(), operatorApp), operatorApp),
          operatorApp
        ),
        basePath
      ),
      basePath
    )
  )
  const invitationPages = () => mountedInvitationPages([{ basePath, presetApp: presetApp() }])
  const publicPaths = memoizeOnce(
    () =>
      new Set([
        at(LOGIN_RELATIVE_PATH),
        at(FORGOT_PASSWORD_RELATIVE_PATH),
        at(RESET_PASSWORD_RELATIVE_PATH),
        ...invitationPages().map((page) => page.path),
      ])
  )
  return {
    basePath,
    get presetApp() {
      return presetApp()
    },
    get publicPaths() {
      return publicPaths()
    },
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
 * @param operatorApp - the operator's decoded config (source of `admin`).
 * @param resolvePreset - answers the decoded embedded preset, on first use.
 * @param adminMode - the resolved `SOVRIUM_ADMIN` kill switch.
 */
export const buildEmbeddedAppMounts = (
  operatorApp: App,
  resolvePreset: () => App,
  adminMode: SovriumAdminMode
): readonly EmbeddedAppMount[] =>
  adminMode === 'off' || operatorApp.admin === false
    ? []
    : [buildMount(resolvePreset, DEFAULT_ADMIN_MOUNT_PATH, operatorApp)]

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
 * What one mounted request resolved to, as a tagged union the route reads by
 * tag: a page to render, or "no synthesized surface — render the preset page
 * as authored".
 */
export type MountSurfaceOutcome =
  { readonly kind: 'app'; readonly app: App } | { readonly kind: 'none' }

// ─── THERE IS NO `redirect` OUTCOME ─────────────────────────────────────────
//
// Every console destination is an authored preset page, and a page states that intent
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
  /** The console page's language, which names the operator's tables when the app declares it. */
  readonly language?: string | undefined
}

/**
 * The operator table an AUTHORED console page binds by route segment, projected
 * to the fields THIS caller may read.
 *
 * Exactly one shape today: the Records explorer at `/records/:table`, whose grid
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
const routeBoundOperatorTables = (input: MountSurfaceInput): NonNullable<App['tables']> => {
  const { operatorApp, session } = input
  const tableName = parseRecordsGridRoute(input.mountPath)
  if (tableName === undefined) return []
  const table = (operatorApp.tables ?? []).find((declared) => declared.name === tableName)
  if (table === undefined) return []
  const projected = readableTableProjection(operatorApp, table, session)
  if (!projected) return []
  // Finished text in the operator's language (else the app's first), and in each for the import.
  const translators = consoleLabelTranslators(operatorApp.languages, input.language)
  return [consoleTableView(projected, { session, tables: operatorApp, ...translators })]
}

/**
 * One operator table with every field this caller may not read removed — a
 * link, count, rollup or lookup the records API withholds from her included —
 * and from the `permissions.fields` entry that named the restriction.
 *
 * `undefined` when the caller may not read the table at all, or when nothing of
 * it is readable: the mount merges nothing and the page answers 404, as an
 * unknown table does (S1). An app with no `auth` is the full-access model.
 */
const readableTableProjection = (
  operatorApp: App,
  table: NonNullable<App['tables']>[number],
  session: SessionInfo | undefined
): NonNullable<App['tables']>[number] | undefined => {
  if (!operatorApp.auth) return table

  const reader = callerReaderFromSession(session, operatorApp)
  const plan = buildReadAccessPlan({
    app: operatorApp,
    table: table as TableLike,
    principal: tableReadPrincipal(table, reader),
    policy: CANONICAL_READ_POLICY,
    // No `rowContext`: `restrictedColumns` reads FIELD permissions alone; only
    // `rowPredicate` would consult it, and no row decision is made here.
  })
  if (!plan.allowed) return undefined
  // A write-only field this caller is told the presence of stays, to be named.
  const withheld = reader && { ...reader, signedOut: false }
  const refused = relatedFieldsWithheldFrom(operatorApp, table.name, withheld)
  const hidden = (name: string) =>
    refused.has(name) || (plan.restrictedColumns.has(name) && !plan.presenceColumns.has(name))
  const fields = table.fields.filter((field) => !hidden(field.name))
  if (fields.length === 0) return undefined
  if (fields.length === table.fields.length) return table

  const { permissions } = table
  const scopedPermissions =
    permissions?.fields === undefined
      ? permissions
      : {
          ...permissions,
          fields: permissions.fields.filter((entry) => !hidden(entry.field)),
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
 * Every console path is an authored preset page matched by the ordinary page
 * router, and a preset page's links are mount-relative and are moved onto this
 * mount's base once, on first use (`buildMount`) — so there is no per-path
 * composition and no link rewrite to perform here.
 *
 * What this does is narrow and is spelled out in the body: the three places a
 * preset page needs something only the mount holds. An ordinary console page
 * takes the `none` branch and renders from the preset alone.
 *
 * ─── THE ONE PLACE THE MOUNT KNOWS THE OPERATOR'S SCHEMA ───────────────────
 *
 * A config page cannot inject an operator TABLE into the app that renders it,
 * and the Records grid needs one: `table` resolves columns, field meta and
 * permissions from the RENDERING app's `tables`, so `/records/contacts` renders
 * no columns unless `contacts` is present there. `columnsFrom: table` and the
 * route-bound `dataSource.table: $param.table` both read the SAME list, so
 * without the merge the page answers 404 for every table the operator declares.
 *
 * That merge is {@link routeBoundOperatorTables}, and it is the deliberate seam
 * — the single place the mount is allowed to look at the operator's schema
 * rather than only at its config, and the only path that serves
 * `/records/:table`.
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
  // `/records/:table`, and the two below for every path but the Components
  // surface — so an ordinary console page takes the `none` branch untouched and
  // renders from the preset alone.
  //
  // NOT re-pointed through `rewriteConsoleRootHrefs`: a preset page's links were
  // moved onto this mount's base once, on first use (`buildMount`). Walking them
  // again here would be a second rewrite of already-correct hrefs, and would
  // additionally walk the operator's own table declarations.
  const tables = routeBoundOperatorTables(input)
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
