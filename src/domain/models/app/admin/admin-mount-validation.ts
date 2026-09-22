/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin-mount subtree cross-validation (founder decision D4).
 *
 * A mount owns its WHOLE subtree: `/_admin` answers `/_admin` and every
 * `/_admin/**` path, and it is registered ahead of redirect matching and page
 * resolution. So an operator `pages[]`, `forms[]` or `redirects[].from` route
 * at or under a mount is not merely redundant — it is permanently unreachable,
 * with nothing in the config or the logs saying why.
 *
 * That is the identical silent-shadowing class `validateAllLinkRules` refuses
 * to boot with for `/l` and `validateAllShareRules` for `/s`, and it is refused
 * here for the same reason plus a sharper one. D4 says the operator can neither
 * break NOR DEGRADE the console: a shadowed route is the degradation, because
 * the operator would ship a page that never renders — or, worse, displace part
 * of the console they need in order to diagnose it.
 *
 * ─── WHY THE MESSAGE NAMES BOTH SIDES ──────────────────────────────────────
 *
 * The operator cannot act on "path unavailable". Only naming the mount AND the
 * page tells them which route to move, and the console's own base is not one of
 * the two — it is fixed at `/_admin`, so the page is what moves, or the console
 * goes away entirely with `admin: false`.
 *
 * ─── WHAT THIS DOES NOT CHECK ──────────────────────────────────────────────
 *
 *  - **The kill switch.** `SOVRIUM_ADMIN=off` is an environment fact, invisible
 *    to the schema, and deliberately so: a config must not become valid or
 *    invalid depending on the deployment it is read in. A collision is refused
 *    even on an instance where the console is switched off, so the operator
 *    finds out at the moment they write it rather than on the day someone
 *    switches the console back on.
 *  - **The public directory.** A `public/_admin/` folder would shadow the
 *    mount, but the filesystem is a runtime concern the schema has no view of.
 *
 * A standalone module, mirroring `share-validation.ts`, so the `AppSchema`
 * filter chain stays shallow — every additional top-level `Schema.check` pushes
 * TypeScript's inference depth over the limit and collapses the derived `App`
 * type to `never`. This module is called from INSIDE the existing bundled
 * filter, never as a new one.
 */

import { DEFAULT_ADMIN_MOUNT_PATH } from '@/domain/models/app/admin/mount-hrefs'
import { stripLanguagePrefix } from '../redirects'

/** Minimal shape needed to validate mount subtrees. */
interface AppForAdminMountValidation {
  readonly admin?: boolean | undefined
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly forms?: ReadonlyArray<{ readonly name: string; readonly path?: string | undefined }>
  readonly redirects?: ReadonlyArray<{ readonly from: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/**
 * The paths the console occupies for validation purposes.
 *
 * One path or none, because the base is fixed. An ABSENT `admin` key means the
 * console is served, so the default subtree is protected without the operator
 * declaring anything — which is the common case, and the one a collision is
 * most likely to surprise someone in.
 */
const mountPathsOf = (app: AppForAdminMountValidation): readonly string[] =>
  app.admin === false ? [] : [DEFAULT_ADMIN_MOUNT_PATH]

/**
 * The mount a declared path falls inside, or `undefined`.
 *
 * The language prefix is stripped first, using the SAME helper the redirect
 * matcher uses: a French page declared at `/fr/_admin/rapports` resolves to
 * `/_admin/rapports` once the locale segment is removed, which is exactly the
 * path the mount would answer — so comparing the raw string would miss it.
 *
 * The subtree test is `${mount}/` and never a bare `startsWith(mount)`, so a
 * sibling route that merely shares a prefix (`/_administration` beside
 * `/_admin`) is left alone rather than being falsely claimed.
 */
const claimingMount = (
  path: string,
  mounts: readonly string[],
  languageCodes: ReadonlyArray<string>
): string | undefined => {
  const { path: bare } = stripLanguagePrefix(path, languageCodes)
  return mounts.find((mount) => bare === mount || bare.startsWith(`${mount}/`))
}

/** One declared route, reduced to what a collision report needs to say. */
interface DeclaredRoute {
  /** The kind of declaration, as it appears in the message. */
  readonly kind: string
  /** How the offender is identified — a name, or the redirect's own source. */
  readonly subject: string
  /** The declared path. */
  readonly path: string
  /** Why the collision is fatal, phrased for that kind. */
  readonly consequence: string
}

/** Every path-claiming declaration in the config, in the order they are reported. */
const declaredRoutes = (app: AppForAdminMountValidation): readonly DeclaredRoute[] => [
  ...(app.pages ?? []).map((page) => ({
    kind: 'page',
    subject: `page "${page.name}"`,
    path: page.path,
    consequence: 'so this page would never render',
  })),
  ...(app.forms ?? []).flatMap((form) =>
    form.path === undefined
      ? []
      : [
          {
            kind: 'form',
            subject: `form "${form.name}"`,
            path: form.path,
            consequence: 'so this form would be unreachable at that path',
          },
        ]
  ),
  ...(app.redirects ?? []).map((redirect) => ({
    kind: 'redirect',
    subject: `redirect from "${redirect.from}"`,
    path: redirect.from,
    consequence: 'so this rule would never fire',
  })),
]

/**
 * Validate that nothing in the config claims a path inside an admin mount.
 *
 * @returns `true` when valid, or an error message describing the first problem.
 */
export const validateAllAdminMountRules = (app: AppForAdminMountValidation): true | string => {
  const mounts = mountPathsOf(app)
  if (mounts.length === 0) return true
  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  const collision = declaredRoutes(app).flatMap((route) => {
    const mount = claimingMount(route.path, mounts, languageCodes)
    return mount === undefined ? [] : [{ route, mount }]
  })[0]
  if (collision === undefined) return true

  const { route, mount } = collision
  const where = route.kind === 'redirect' ? '' : ` (${route.path})`
  return `admin mount "${mount}" collides with ${route.subject}${where}. A mount owns its whole subtree and is matched before ${route.kind} resolution, ${route.consequence}. Move the ${route.kind} off "${mount}", or set admin: false.`
}
