/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Moving an embedded app's internal links onto the base path it is mounted at.
 *
 * The admin console is authored as `src/admin/` — a standalone app that boots
 * on its own at `/` under `bun run app:admin`. Its own pages therefore link
 * each other MOUNT-RELATIVE (`/login`, `/forgot-password`), which is the only
 * spelling that is correct in both worlds: served standalone at the site root,
 * and served under the `/_admin` base it is mounted at inside an operator's
 * app. Nothing here reads the base from config: it is always an argument, so
 * this module never learns which of the two worlds it is running in — and the
 * standalone boot, which performs no rewrite at all, never calls it.
 *
 * Turning those into real URLs is this module's whole job, and it is a pure
 * string walk over an already-decoded config.
 *
 * ─── TWO SPELLINGS, TWO FUNCTIONS ──────────────────────────────────────────
 *
 * The console's links exist in two representations, and they must not be
 * conflated:
 *
 *  - the PRESET's own pages are mount-relative, and get {@link prefixMountHrefs};
 *  - a bundled CLIENT catalogue is authored against the default mount and
 *    carries absolute `/_admin/...` links, which
 *    {@link rewriteConsoleRootPath} moves onto the mount the document is
 *    actually served at.
 *
 * The second used to be the SERVER's problem too: the per-request surfaces
 * built under `application/use-cases/admin/dashboard-surfaces/` wrote absolute
 * links and were re-pointed on their way out. There are none left — every
 * console destination is an authored preset page, so its links are
 * mount-relative like everything else — and the only reader now is the island
 * bundle, which is built once, ahead of any request, and so cannot bake in a
 * base at all.
 *
 * With the base fixed at `/_admin`, that rewrite is an exact IDENTITY today and
 * the sentinel and the base hold the same string. Both survive because they are
 * the two halves of a contract the bundle cannot otherwise state: it needs SOME
 * spelling of "console root" at build time, and the server needs a defined
 * place to move it to. Collapsing them to one literal would put that contract
 * back into forty call sites, where nothing names it.
 *
 * ─── WHAT IS DELIBERATELY NOT REWRITTEN ────────────────────────────────────
 *
 * `endpoint` is never touched. A component's `endpoint` addresses the JSON API
 * (`/api/admin/...`), which is mounted once for the whole server and is not
 * part of any console mount — prefixing it would point every data component at
 * a route that does not exist. For the same reason an `href` that is already
 * under `/api/` or `/assets/` is left alone, as is anything absolute
 * (`https://…`), protocol-relative (`//…`), or a bare fragment/query.
 *
 * `path` is the one navigation value that is NOT a key, and it is the third
 * link this walk silently dropped after `hrefTemplate` and `showWhen.section`
 * — so the shape is worth naming rather than re-discovering. A `navigate`
 * action's `path` IS a link: the console spells "My account" as
 * `{ type: 'navigate', path: '/profile' }` and the menu island renders that
 * straight into `<a href>`, so on a mount it has to move onto the base like
 * every href beside it. But the key cannot simply join {@link NAVIGATION_KEYS},
 * because at least five unrelated places in `AppSchema` spell `path` and
 * several of them hold values beginning with `/`, so the leading-slash guard
 * rescues nothing: `pages[].path` and `forms[].path` are ROUTES, matched
 * against the request AFTER `toMountPath` has stripped the base — prefix one
 * and every console page 404s, a far bigger outage than the link it fixes —
 * while `agents[].knowledge[].path` and a file action's `path` are storage
 * locations that a URL base addresses nothing in. What decides the rewrite is
 * therefore the SURROUNDING ACTION (`type: 'navigate'`), not the key name.
 * `isMountLocalPath` still guards it, which is what keeps the two external
 * `navigate` rows the console really ships (the feedback and bug-report links)
 * from being mangled into `/_admin/https:/…`.
 */

/**
 * The DOM attribute a mounted document uses to tell its client islands which
 * base path is serving them.
 *
 * It is rewritten by the same walk as every other console link, and that is the
 * point: the attribute IS a reference to the console root, so it moves with the
 * mount for free rather than needing `basePath` threaded through twenty-one
 * shell builders. The synthesized shell writes it as the absolute sentinel and
 * the preset's own pages write it mount-relative (`/`); both land on the base.
 */
export const MOUNT_BASE_PATH_ATTRIBUTE = 'data-admin-base-path'

/** The keys whose string values address a page within the mounted app. */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  'href',
  'navigate',
  'to',
  'url',
  // A path with `{field}` placeholders is still a path. Two config keys spell
  // one: `page.redirectToFirst.hrefTemplate` (the 302 target of a bare
  // collection) and `sidebar.groups[].source.hrefTemplate` (where each fetched
  // entry links). Both are authored mount-relative like every other href, and
  // both were invisible to this walk — so a mounted `/tables` redirected the
  // operator to `/tables/contacts`, straight OUT of the console and into the
  // operator's own page space, where it 404s.
  //
  // The placeholders survive the prefix untouched: this rewrites the path's
  // head, and the template is filled from the first row afterwards.
  'hrefTemplate',
  // `sidebar…showWhen.section` — the path a scoped entry is gated on. It is
  // matched against the REQUEST path by the same prefix rule an `activeMatch`
  // uses, so on a mount it has to live in the mount's own space exactly as the
  // hrefs beside it do. Left out, a gated entry on the mounted console is
  // compared against `/_admin/…` and never matches: the row simply is not
  // there, on every page, with nothing logged.
  //
  // Safe as a bare key name despite how generic `section` reads. The only other
  // schema key spelled that way is `design.spacing.section`, whose value is a
  // Tailwind class run (`py-16 sm:py-20`) — and `isMountLocalPath` rewrites
  // nothing that does not begin with `/`.
  'section',
  MOUNT_BASE_PATH_ATTRIBUTE,
])

/**
 * Paths that are server-global rather than mount-local.
 *
 * These are mounted once per server, outside any console base, so prefixing one
 * produces a 404 rather than a relocated link.
 */
const SERVER_GLOBAL_PREFIXES: readonly string[] = ['/api/', '/assets/', '/.well-known/']

/** The canonical spelling of "the console root" inside synthesized surfaces. */
export const CONSOLE_ROOT_SENTINEL = '/_admin'

/**
 * Where the operator console is served. Fixed, and not configurable.
 *
 * Underscore-prefixed so it cannot collide with an ordinary route an operator
 * would think to write, and so `isPageInSitemap`'s existing `/_` rule already
 * treats it as internal.
 *
 * It holds the same string as {@link CONSOLE_ROOT_SENTINEL} and is deliberately
 * a separate name: the two answer different questions. This one is WHERE the
 * console is served; the sentinel is how a link into the console is SPELLED
 * inside a bundle that ships before the base is known.
 */
export const DEFAULT_ADMIN_MOUNT_PATH = '/_admin'

/**
 * The mount-relative base of the framed specimen documents.
 *
 * A `specimen` declaring a `viewport` is re-rendered inside an `<iframe>` whose
 * document is served from here, so that the subject's own `@media` rules
 * evaluate against the declared width rather than against the reader's window.
 *
 * ─── WHY THE ADDRESS IS A DOMAIN CONSTANT AND NOT A RENDERER LITERAL ───────
 *
 * Two modules have to agree on it and they sit on opposite sides of the app:
 * the route that answers it (`presentation/api/admin/mounted-app-routes.ts`)
 * and the renderer that points at it
 * (`presentation/render/registry/design-components.tsx`). A literal written
 * twice is a frame that silently 404s the day one of them moves — and a 404
 * inside an `<iframe>` is invisible above the fold, which is precisely the
 * class of failure that made the review row this capability answers.
 *
 * `component-frame` and not `preview`: the retired `/preview/:section` routes
 * were whole DESTINATIONS a reader could open, and they were retired because a
 * second host for the same content is a second place for the scheme and the
 * bounds to disagree. This is the inside of a frame — linked from nothing,
 * carrying no chrome, embeddable only by its own origin — so it takes a name
 * that cannot be mistaken for the thing that was removed.
 */
export const COMPONENT_FRAME_BASE = '/design-system/component-frame'

/**
 * The address of one component's framed document, as an `<iframe>` `src`.
 *
 * Absolute from the origin root rather than relative to the page: a specimen is
 * an ordinary page component that any config may declare, so the page drawing
 * it may sit at any depth — and the framed document is always the CONSOLE's,
 * which is served at the one fixed base
 * ({@link DEFAULT_ADMIN_MOUNT_PATH}). Resolving relatively would make the
 * subject's address depend on where it happened to be documented.
 *
 * @param name - the operator template the frame re-renders.
 */
export const componentFrameHref = (name: string): string =>
  `${DEFAULT_ADMIN_MOUNT_PATH}${COMPONENT_FRAME_BASE}/${encodeURIComponent(name)}`

/**
 * Whether a navigation value is an in-app path this module may rewrite.
 *
 * Rejects protocol-relative `//host` before the leading-slash test, since it
 * satisfies `startsWith('/')` while naming another origin entirely.
 */
const isMountLocalPath = (value: string): boolean =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !SERVER_GLOBAL_PREFIXES.some((prefix) => value.startsWith(prefix))

/**
 * Join a mount's base path with a path relative to that mount.
 *
 * @param basePath - the mount's base, without a trailing slash (`/_admin`).
 * @param relative - a mount-relative path beginning with `/`; `/` is the root.
 */
export const mountHref = (basePath: string, relative: string): string =>
  relative === '/' ? basePath : `${basePath}${relative}`

/**
 * Map a request path to the path within the mounted app.
 *
 * `/_admin` and `/_admin/` both resolve to `/` (the mounted app's home);
 * `/_admin/tables/contacts` resolves to `/tables/contacts`.
 *
 * @param basePath - the mount's base path.
 * @param requestPath - the incoming request path, base included.
 */
export const toMountPath = (basePath: string, requestPath: string): string => {
  const stripped = requestPath.slice(basePath.length)
  if (stripped === '' || stripped === '/') return '/'
  return stripped
}

/**
 * Rewrite every navigation value in a value tree with `transform`.
 *
 * A value is a navigation value when its KEY says so ({@link NAVIGATION_KEYS})
 * or when the node it sits on is a `navigate` action and the key is `path` —
 * the one context-sensitive case, for the reasons in this module's header.
 */
const walkNavigationValues = (value: unknown, transform: (path: string) => string): unknown => {
  if (Array.isArray(value)) return value.map((item) => walkNavigationValues(item, transform))
  if (typeof value !== 'object' || value === null) return value
  const navigateAction = (value as Record<string, unknown>)['type'] === 'navigate'
  const entries = Object.entries(value as Record<string, unknown>).map(([key, child]) => {
    if (
      (NAVIGATION_KEYS.has(key) || (navigateAction && key === 'path')) &&
      typeof child === 'string'
    ) {
      return [key, isMountLocalPath(child) ? transform(child) : child] as const
    }
    return [key, walkNavigationValues(child, transform)] as const
  })
  return Object.fromEntries(entries)
}

/**
 * Move a mount-relative value tree onto `basePath`.
 *
 * Applied to the PRESET's own pages, whose links are authored relative to the
 * mount. Not idempotent by construction — applying it twice would prefix twice
 * — so it is applied exactly once, when a mount is built at boot.
 *
 * @param value - any part of the preset config (a page, a component, the app).
 * @param basePath - the mount's base path.
 */
export const prefixMountHrefs = <T>(value: T, basePath: string): T =>
  walkNavigationValues(value, (path) => mountHref(basePath, path)) as T

/**
 * Re-point absolute console links at `basePath`.
 *
 * The subtree form, kept for the shape rather than for a caller: the server has
 * no synthesised surface left to re-point, and the one remaining reader —
 * `presentation/islands/admin/shared/mount-base-path.ts` — moves ONE path at a
 * time. An exact IDENTITY at `/_admin`, which is the only base the console is
 * served at, so this is a no-op on every path the product takes today.
 *
 * Idempotent for any other base: after one pass no value begins with the
 * sentinel any more, so a second pass is a no-op.
 *
 * @param value - the synthesized surface app (or any subtree of it).
 * @param basePath - the mount's base path.
 */
export const rewriteConsoleRootHrefs = <T>(value: T, basePath: string): T => {
  if (basePath === CONSOLE_ROOT_SENTINEL) return value
  return walkNavigationValues(value, (path) => rewriteConsoleRootPath(path, basePath)) as T
}

/**
 * The single-path form of {@link rewriteConsoleRootHrefs}.
 *
 * The form the CLIENT spends. A bundled island catalogue carries the sentinel
 * because it is built ahead of any request, so each of its links is resolved
 * against the document's own base at read time by
 * `presentation/islands/admin/shared/mount-base-path.ts` — which reads that
 * base off the DOM rather than assuming it, so a palette row lands inside the
 * console the operator is actually browsing.
 *
 * @param path - a path possibly beginning with {@link CONSOLE_ROOT_SENTINEL}.
 * @param basePath - the mount's base path.
 */
export const rewriteConsoleRootPath = (path: string, basePath: string): string => {
  if (basePath === CONSOLE_ROOT_SENTINEL) return path
  if (path !== CONSOLE_ROOT_SENTINEL && !path.startsWith(`${CONSOLE_ROOT_SENTINEL}/`)) return path
  return mountHref(basePath, path.slice(CONSOLE_ROOT_SENTINEL.length) || '/')
}
