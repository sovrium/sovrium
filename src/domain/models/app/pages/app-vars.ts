/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * `$app.*` — the app's own facts, referenceable in any string a page carries.
 *
 * ─── WHY A CLOSED SET ──────────────────────────────────────────────────────
 *
 * An open path expression over the config (`$app.<anything>`) would put every
 * config value one typo away from a rendered page — `env`, `connections`, a
 * `description` written for maintainers rather than visitors. The four names
 * below are a vocabulary, and a reference outside it is left VERBATIM rather
 * than resolved to a blank, so an author sees the literal in the output and
 * learns the name does not exist.
 *
 * ─── WHY IT EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * `vars` are fixed at author time, `$query.*` reads the URL and `$t:` reads the
 * translation catalogue; none of them can name the app SERVING the page. For a
 * standalone app that is a mild annoyance — the name is a constant it could
 * hardcode. For an EMBEDDED one it is a hard block: a console mounted into an
 * operator's app must print the OPERATOR's name and the OPERATOR's origin, and
 * neither is reachable from its own config.
 *
 * ─── WHY `basePath` IS IN THIS SET AND NOT IN A `$mount.*` OF ITS OWN ──────
 *
 * A page can already LINK mount-portably: `mount-hrefs.ts` rewrites the head of
 * every navigation key — `href`, `navigate`, `to`, `url`, `hrefTemplate` — so a
 * mount-relative `/design-system/ui-kit/button` becomes `/_admin/design-system/
 * ui-kit/button` wherever the console is mounted. What it deliberately does not
 * rewrite is `content`: a path a page PRINTS as text is not a link, and a walk
 * that prefixed every string would corrupt prose that merely contains a slash.
 *
 * So a page that shows a reader the route it is on — the console's per-type
 * pages print their own address — had no spelling that is true in BOTH worlds
 * the console is served in. The builder they replaced hardcoded `/_admin`,
 * which prints the wrong address whenever `src/admin` boots standalone at the
 * site root (`bun run app:admin`), where the base is `''`.
 *
 * A `$mount.*` namespace was considered and refused. It would be a SECOND
 * closed set with its own grammar, its own substitution pass, its own
 * unresolved-reference rule and its own arm in every page-binding validator —
 * all to carry one name. And the split it proposes is not real: `$app.*` is
 * already documented as "the app SERVING the page", and `origin` — the scheme
 * and host this request arrived on — is exactly as much a fact about the
 * serving as the base path is. `origin` and `basePath` are the two halves of
 * one address, and `$app.origin$app.basePath/x` composes an absolute URL only
 * because they sit in one vocabulary.
 *
 * ─── WHY `engineVersion` IS IN THIS SET TOO ────────────────────────────────
 *
 * Operator chrome names the app and then the engine under it: `<app> v<ver>
 * (Sovrium v<engine>)`. The first half has been buildable since `version`
 * landed; the second half had no spelling at all, and the three places it might
 * have come from were each measured and each refused:
 *
 *  1. `version` above is the SERVING APP's declared version, which under a mount
 *     is the operator's — the opposite of what the second half names.
 *  2. `GET /api/admin/instance` reports that same app version, so reading it
 *     would print the operator's number inside the engine's parentheses.
 *  3. `GET /api/admin/config/version` IS the engine read, and no shell surface
 *     can bind it: a page binds ONE system record and the sidebar belongs to all
 *     thirty-odd of them, so a `kpi` pointed at the endpoint would draw a
 *     loading skeleton in the sidebar head of every full page load.
 *
 * So the console's identity row named the app and stopped.
 *
 * It belongs HERE and not in an `$engine.*` of its own, for the reason spelled
 * out for `basePath` two paragraphs up and not restated: a second namespace
 * carrying exactly one name is a second grammar, a second substitution pass, a
 * second unresolved-reference rule and a second arm in every page-binding
 * validator. And the boundary it proposes is not where the seam is. `$app.*`
 * already means *the app SERVING the page*, and `origin` — the host this request
 * arrived on — is a fact about the SERVING rather than about the config. The
 * engine version is the same kind of fact: not what the config says, but what is
 * running it. `$app.label v$app.version (Sovrium v$app.engineVersion)` is one
 * sentence, and it resolves in one pass only because all three share a set.
 *
 * It follows `origin`'s rule, NOT `version`'s. The engine ALWAYS has a version —
 * `getSovriumVersion()` falls back to `'0.0.0'` and never throws — so an absent
 * value here never means "correctly undeclared"; it means the caller was not
 * threaded one. The surviving `$app.engineVersion` literal is the signal, and it
 * is a loud one, which is exactly right for a fault that only a developer can
 * fix. Blanking it would ship `(Sovrium v)` to an operator.
 */
export const APP_VAR_NAMES = [
  'name',
  'label',
  'version',
  'origin',
  'basePath',
  'engineVersion',
] as const

/** One `$app.<name>` token from the closed set. */
export type AppVarName = (typeof APP_VAR_NAMES)[number]

/**
 * A config `name` in DISPLAY form: `acme-console` → `Acme Console`.
 *
 * A config name is an npm-style slug — right in a URL, an id or a directory,
 * wrong in page chrome. Title-casing it at every call site is the copy-paste
 * `$app.label` exists to end, so it is done once, here.
 *
 * Only the separators are touched: a part already carrying internal capitals
 * (`myAPI`) keeps them, because lowercasing the tail would corrupt a name the
 * author chose deliberately.
 */
export const titleCaseAppName = (name: string): string =>
  name
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

/**
 * The resolved value of every `$app.*` token this app can answer.
 *
 * A token the app cannot answer is ABSENT from the map rather than empty: the
 * substitution leaves an unresolvable reference verbatim, and a blank would be
 * indistinguishable from a formatting bug.
 *
 * ─── `version` IS THE ONE EXCEPTION, AND ALWAYS RESOLVES ───────────────────
 *
 * It answers the EMPTY STRING when the app declares none, rather than being
 * absent. `version` is the only name in the closed set whose absence is a
 * permanent, legal property of a VALID config: `name` and `label` always
 * resolve, and `origin` is missing only OUTSIDE a request — a context the
 * author can act on. So the "a surviving literal teaches the author the field
 * is not declared" argument, which is right for the other three, fires on
 * CORRECT configs here and is therefore not a signal at all.
 *
 * It is also actively harmful in one place. A token substituted into a
 * STRUCTURED value — `data-island-props='{"appVersion":"$app.version"}'`, the
 * shape the admin console's shell is authored in — has no reader to teach:
 * the literal becomes a JSON string, and every downstream "no version declared"
 * fall-back sees a non-empty value and takes the token for a real version. An
 * empty string is the value each of those fall-backs already tests for.
 *
 * Deliberately NOT generalised to the other three. `$app.description` (outside
 * the set) and `$app.origin` on a static render must keep surviving, because
 * there a visible literal IS the actionable signal.
 *
 * @param app - the app SERVING the page. For a mounted embedded app that is the
 *   OPERATOR's app, which is the whole point of the token.
 * @param origin - the scheme + host this request arrived on, when known. Absent
 *   outside a request (a static render, an error page), where `$app.origin` is
 *   left verbatim rather than guessed.
 * @param basePath - the base this app is being SERVED at: `''` for a standalone
 *   app at the site root, `/_admin` for the mounted console. It follows
 *   `origin`'s rule and not `version`'s — ABSENT means the caller has no mount
 *   context to offer, and the token survives verbatim rather than resolving to
 *   a blank.
 *
 *   The distinction is load-bearing and it is the whole reason this is not
 *   defaulted to `''`. An empty base is a legitimate ANSWER (a standalone app)
 *   and a caller that knows it must pass it. A caller that simply has not been
 *   threaded the value would, under a `''` default, make a MOUNTED page print
 *   `/design-system/ui-kit/button` — a well-formed path, to a page of the
 *   operator's own app, that 404s. That is the failure mode which looks most
 *   like success, and the surviving literal is what stops it being silent.
 *
 * @param engineVersion - the version of the SOVRIUM ENGINE serving this render,
 *   as resolved once at boot by `getSovriumVersion()`. It follows `origin`'s
 *   rule: ABSENT means the caller has no engine context to offer and the token
 *   survives verbatim. It is a parameter rather than a read because this module
 *   is domain-pure — the version comes from a build-time define or a
 *   `package.json` read, both of which are infrastructure — and because the
 *   value is a process constant the composition root already holds.
 */
export const resolveAppVarValues = (
  app: App,
  origin: string | undefined,
  basePath?: string,
  engineVersion?: string
): Readonly<Partial<Record<AppVarName, string>>> => ({
  name: app.name,
  label: titleCaseAppName(app.name),
  version: app.version ?? '',
  ...(origin !== undefined ? { origin } : {}),
  ...(basePath !== undefined ? { basePath } : {}),
  ...(engineVersion !== undefined ? { engineVersion } : {}),
})

/** The token an `$app.origin` reference is written as, in full. */
export const APP_ORIGIN_TOKEN = '$app.origin'
