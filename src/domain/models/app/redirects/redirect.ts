/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'

/**
 * A path `from` which a retired URL redirects.
 *
 * Must be a root-relative path (leading `/`). Query strings and fragments are
 * NOT part of the match key — the incoming query string is preserved and
 * carried onto the target, so encoding one here would be silently ignored.
 */
const RedirectFromSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "Root-relative path to redirect FROM (e.g. '/products/platform'). Matched locale-agnostically unless it already begins with a configured language segment.",
  }),
  Schema.check(
    Schema.isPattern(/^\/[^\s?#]*$/, {
      message:
        "redirect 'from' must be a root-relative path starting with '/' and must not contain whitespace, '?' or '#'",
    })
  )
)

/**
 * The `to` target of a redirect: either a root-relative path or an absolute
 * `http(s)` URL (for a hand-off to a different origin).
 *
 * A PROTOCOL-RELATIVE target (`//evil.example.com`) is rejected: a browser
 * resolves it as an absolute cross-origin URL, so accepting it would turn a
 * redirect table into an open-redirect primitive. Cross-origin hand-offs must
 * be written with an explicit `https://` scheme so the intent is visible in the
 * config being reviewed.
 *
 * The pattern below is NOT sufficient alone, which is why a second check
 * follows it. Its `(?!\/)` guard rejects only a literal second slash, so the
 * equivalent BACKSLASH form `/\evil.com` passed — and every WHATWG parser
 * (browser, `fetch`, `new URL`) normalises backslashes to slashes for special
 * schemes, resolving it to `https://evil.com/`. The value reaches `c.redirect`
 * verbatim in `route-setup/redirect-routes.ts`, so a target that reads as a
 * local path under review behaved as a cross-origin redirect at runtime. The
 * same holds for a target containing a tab, CR or LF, which URL parsing strips
 * from anywhere in the string.
 *
 * Enumerating those forms is the losing move. The PATH branch is therefore
 * closed by construction with {@link isSafeRedirectPath}, which resolves the
 * candidate against a fixed synthetic base and requires the origin to come back
 * unchanged — so forms not yet invented fail too. That helper is the single
 * canonical redirect-target check in the codebase; do not add a second one.
 */
// The `annotate` comes FIRST, before either `check`. In Effect 4 a trailing
// annotate attaches to the preceding CHECK rather than to the node, and with two
// checks in the pipe the `description` stopped reaching
// `apps/website/public/schema/app.json` — silently costing config authors the
// editor tooltip for `redirects[].to`. It survived with a single check, so the
// ordering only becomes load-bearing at the second one. Caught by Schema Drift.
const RedirectToSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "Redirect target — a root-relative path (e.g. '/') or an absolute http(s) URL. A path target inherits the request's language prefix; an absolute URL is used verbatim.",
  }),
  Schema.check(
    Schema.isPattern(/^(?:\/(?!\/)[^\s#]*|https?:\/\/[^\s]+)$/, {
      message:
        "redirect 'to' must be a root-relative path starting with a single '/' or an absolute http(s) URL (protocol-relative '//host' targets are rejected as open redirects)",
    })
  ),
  Schema.check(
    Schema.makeFilter((value: string) =>
      // The absolute-URL branch is a deliberate, explicitly-written cross-origin
      // hand-off and is left to the pattern above; only the PATH branch has to
      // prove that it stays on this origin.
      !value.startsWith('/') || isSafeRedirectPath(value)
        ? true
        : "redirect 'to' resolves to a different origin. A path target must stay on this origin — '/\\host', '//host', and paths containing a tab, CR or LF all resolve cross-origin. Write an explicit 'https://' URL if a hand-off is intended."
    )
  )
)

/**
 * Whether a path `to` inherits the language prefix matched by `from`.
 *
 * Defaults to `true` — a French visitor to `/fr/products/platform` must land on
 * `/fr/`, not on the English `/`. But that inheritance is unconditional, and
 * some targets have no locale to inherit: an admin console (`/_admin/*`), a
 * webhook receiver, a health endpoint, an asset path. Prefixing those
 * manufactures a 404 under a language segment the target never had — a 301 into
 * a 404, which is strictly worse than a clean 404 because it burns the redirect,
 * still fails, and walks a crawler into a dead end.
 *
 * `localizeTarget: false` is the opt-out, and it governs the TARGET only: `from`
 * keeps matching every locale variant, or the French visitor would get no
 * redirect at all — the very failure the opt-out exists to avoid. The field
 * names the side it governs for exactly that reason; a bare `localize` would
 * read as "turn i18n off for this rule".
 *
 * MEANINGLESS ON AN ABSOLUTE TARGET — an absolute `http(s)` `to` already leaves
 * the app and is emitted verbatim, so the flag cannot change anything there.
 * That combination is rejected at decode time rather than silently ignored.
 */
const RedirectLocalizeTargetSchema = Schema.Boolean.pipe(
  Schema.annotate({
    description:
      "Whether a root-relative target inherits the language prefix matched by 'from' (default: true). Set false when the target lives outside the locale namespace (e.g. '/_admin/login'), so it is emitted verbatim.",
  })
)

/**
 * The HTTP status a redirect responds with.
 *
 * - `301` Moved Permanently (default) — the retired-URL case; transfers link equity.
 * - `302` Found — temporary, method-rewriting.
 * - `307` Temporary Redirect — temporary, method-preserving.
 * - `308` Permanent Redirect — permanent, method-preserving.
 */
const RedirectStatusSchema = Schema.Literals([301, 302, 307, 308]).pipe(
  Schema.annotate({
    description: 'HTTP redirect status code. Defaults to 301 (Moved Permanently) when omitted.',
  })
)

/**
 * A single redirect rule.
 */
export const RedirectSchema = Schema.Struct({
  /** Root-relative path to redirect FROM. */
  from: RedirectFromSchema,
  /** Redirect target — a root-relative path or an absolute http(s) URL. */
  to: RedirectToSchema,
  /** HTTP status code (default: 301). */
  status: Schema.optional(RedirectStatusSchema),
  /** Whether a path target inherits the matched language prefix (default: true). */
  localizeTarget: Schema.optional(RedirectLocalizeTargetSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Redirect',
    title: 'Redirect Rule',
    description:
      'A single URL redirect: the retired path, its replacement, and the HTTP status to answer with.',
    examples: [{ from: '/products/platform', to: '/', status: 301 as const }],
  })
)

/**
 * Strip a leading language segment from a path when it matches one of the
 * supplied language codes. Returns the path unchanged when it carries no
 * language prefix.
 *
 * Exported for the runtime redirect resolver and its unit tests — the same
 * normalization must be applied on both the config side (collision detection)
 * and the request side (matching), or the two would disagree.
 */
export const stripLanguagePrefix = (
  path: string,
  languageCodes: ReadonlyArray<string>
): { readonly language: string | undefined; readonly path: string } => {
  const segments = path.split('/').filter(Boolean)
  const first = segments[0]
  if (first === undefined || !languageCodes.includes(first)) {
    return { language: undefined, path }
  }
  const remainder = path.slice(`/${first}`.length)
  return { language: first, path: remainder === '' ? '/' : remainder }
}

/**
 * Whether a `to` target is an absolute `http(s)` URL, which leaves the app
 * entirely and is therefore always emitted verbatim — no language prefix
 * applies to it, and `localizeTarget` is inert on it.
 *
 * Exported for the runtime redirect resolver, for the same reason as
 * `stripLanguagePrefix`: the config-side rejection of an inert `localizeTarget`
 * and the request-side decision to skip the prefix must agree on what "absolute"
 * means, or a rule could pass `sovrium validate` and then behave differently.
 */
export const isAbsoluteRedirectTarget = (to: string): boolean =>
  to.startsWith('http://') || to.startsWith('https://')

/**
 * Every request path a `to` target can lead the browser to, in the order the
 * browser reaches them. Absolute URLs leave the app entirely and can never be
 * part of a cycle, so they yield no paths at all.
 *
 * TWO forms, not one — and the pair is the whole point:
 *
 *  1. the **verbatim** path, minus hash and query. This is what the redirect
 *     actually emits in `Location`, and `app.redirects` is registered BEFORE
 *     the canonicalization routes, so this is the form the rule set sees first;
 *  2. the **canonical** path, trailing slashes stripped. Reached only when no
 *     rule matched the verbatim form and trailing-slash normalization then
 *     301s it.
 *
 * Collapsing the two into "the canonical one" loses real loops instead of
 * finding more of them. `{ from: '/x/', to: '/x/' }` is a byte-identical
 * self-redirect and an unconditional infinite loop — the rule matches `/x/`,
 * emits `/x/` verbatim, and matches again, never reaching the normalizer — yet
 * a canonical-only comparison sees `/x` ≠ `/x/` and lets it ship. Likewise the
 * ring `/a/ → /b`, `/b → /a/`. Conversely, `{ from: '/x/', to: '/x' }` must
 * stay VALID: it emits `/x`, which does not match `/x/`, so it terminates.
 *
 * The `'/'` fallbacks are the sharp edge: a bare `replace(/\/+$/, '')` reduces
 * the root `to: '/'` — the single most common target in every shipped config —
 * to the empty string, so both forms must fall back to `/` rather than to `''`,
 * or every root-targeting rule breaks (or `{ from: '/', to: '/' }` stops being
 * caught).
 */
const toComparablePaths = (to: string): readonly string[] => {
  if (!to.startsWith('/')) return []
  const withoutHash = to.split('#')[0] ?? ''
  const withoutQuery = withoutHash.split('?')[0] ?? ''
  const verbatim = withoutQuery === '' ? '/' : withoutQuery
  const stripped = verbatim.replace(/\/+$/, '')
  const canonical = stripped === '' ? '/' : stripped
  return verbatim === canonical ? [verbatim] : [verbatim, canonical]
}

/**
 * Detect a redirect cycle (A → B → A, or any longer ring).
 *
 * Load-bearing, NOT defensive: the runtime resolves exactly ONE hop, so the
 * server can never loop — but the BROWSER can. With `A → B` and `B → A` a
 * visitor to `/A` is sent to `/B`, whose own rule sends them back to `/A`,
 * forever. A cycle is therefore a configuration error that must fail
 * `sovrium validate` rather than ship.
 *
 * Returns the offending `from` path, or `undefined` when the rule set is acyclic.
 */
const findCycleEntry = (
  rules: ReadonlyArray<{ readonly from: string; readonly to: string }>
): string | undefined => {
  const declaredFroms = new Set(rules.map((rule) => rule.from))

  // The next path the rule set actually sees. A target is requested VERBATIM
  // first, so a rule declaring that exact `from` claims it before trailing-slash
  // normalization ever runs; only when none does can the canonical form be
  // reached. Preferring whichever form is declared — rather than always
  // canonicalizing — is what keeps a ring like `/a/ → /b`, `/b → /a/` visible.
  // `undefined` ends the walk: neither form is a `from`, so the chain stops.
  const nextHop = (to: string): string | undefined =>
    toComparablePaths(to).find((candidate) => declaredFroms.has(candidate))

  const targets = new Map(rules.map((rule) => [rule.from, nextHop(rule.to)]))

  /**
   * Follow the chain from `start`, at most `rules.length` hops, and report
   * whether it returns to `start`. Every member of a ring detects its own ring,
   * so testing each rule as a start point finds any cycle — while a path that
   * merely LEADS INTO a ring without being part of it never returns to its own
   * start, and is correctly reported by the ring member instead.
   */
  const leadsBackToStart = (start: string): boolean => {
    const step = (current: string | undefined, remainingHops: number): boolean => {
      if (current === undefined) return false
      if (current === start) return true
      if (remainingHops === 0) return false
      return step(targets.get(current), remainingHops - 1)
    }
    return step(targets.get(start), rules.length)
  }

  return rules.find((rule) => leadsBackToStart(rule.from))?.from
}

/**
 * RedirectsSchema declares the app's retired URLs and where each one now lives.
 *
 * WHY THIS EXISTS — restructuring a site retires URLs, and without this the
 * only possible answer at a retired path is a 404: `access.redirectTo` covers
 * auth denial, `forms.onSuccess` covers post-submit, and the `contentDir.index`
 * 301 is engine-emitted for one specific collection shape. None of them retire
 * a URL. Every indexed link, bookmark and backlink to the old path would break.
 *
 * LOCALE — `from` is matched the way `pages[].path` is authored. A locale-
 * agnostic `from: '/products/platform'` matches the bare path AND every
 * language-prefixed variant the page router serves (`/en/products/platform`,
 * `/fr/products/platform`), and a path `to` inherits the request's language
 * prefix — so a French visitor lands on the French replacement, never the
 * English one. A `from` that already begins with a configured language segment
 * (e.g. `/fr/produits`) is matched literally, exactly like an explicitly
 * per-locale page path.
 *
 * NON-LOCALIZED TARGETS — that inheritance is wrong when the target has no
 * locale to inherit: an admin console, a webhook receiver, a health endpoint, an
 * asset path. `localizeTarget: false` emits the authored `to` verbatim while
 * `from` keeps matching every locale variant. Without it, `{ from: '/login', to:
 * '/_admin/login' }` emits `/en/_admin/login` and `/fr/_admin/login`, both 404 —
 * a 301 into a 404, worse than never redirecting at all.
 *
 * ONE HOP — a matched request emits exactly one redirect; the target is never
 * re-matched against the table. `Location` is always literally what was
 * authored. Chains are rejected as cycles at decode time when they ring.
 *
 * PRECEDENCE — redirects are evaluated AFTER static assets and BEFORE pages. A
 * real file in the public directory always wins (a redirect rule can never
 * hijack `/install`), while a redirect always beats page resolution and the
 * 404 catch-all.
 *
 * @example
 * ```typescript
 * redirects: [
 *   { from: '/products/platform', to: '/' },
 *   { from: '/products/partner', to: '/partner' },
 *   { from: '/login', to: '/_admin/login', localizeTarget: false },
 * ]
 * ```
 */
export const RedirectsSchema = Schema.Array(RedirectSchema).pipe(
  Schema.check(
    Schema.isMinLength(1, {
      message: 'redirects must declare at least one redirect rule when present',
    })
  ),
  // Annotations sit BEFORE the cross-rule filters (mirroring
  // `SystemSourceCatalogSchema`): a trailing `Schema.annotations` after a
  // refinement chain loses its `title`/`description` in the generated JSON
  // Schema, leaving `minItems`' auto-description in their place.
  Schema.annotate({
    identifier: 'Redirects',
    title: 'URL Redirects',
    description:
      'Retired URLs and their replacements. Each rule answers a path with an HTTP redirect (default 301) before page resolution, so restructuring a site never breaks an indexed link.',
    examples: [
      [
        { from: '/products/platform', to: '/' },
        { from: '/products/partner', to: '/partner', status: 301 as const },
      ],
    ],
  }),
  Schema.check(
    Schema.makeFilter((rules) => {
      const duplicate = rules.find(
        (rule, index) => rules.findIndex((other) => other.from === rule.from) !== index
      )
      return duplicate === undefined
        ? true
        : `Duplicate redirect 'from' path '${duplicate.from}' — each path may declare at most one redirect`
    })
  ),
  Schema.check(
    Schema.makeFilter((rules) => {
      // Either form loops: the verbatim target re-matching `from` is the classic
      // self-redirect, and the canonicalized one re-matching it is the same loop
      // routed through trailing-slash normalization.
      const selfRedirect = rules.find((rule) => toComparablePaths(rule.to).includes(rule.from))
      return selfRedirect === undefined
        ? true
        : `Redirect '${selfRedirect.from}' points at itself — a self-redirect loops forever`
    })
  ),
  Schema.check(
    Schema.makeFilter((rules) => {
      // `localizeTarget` governs whether a ROOT-RELATIVE target inherits the
      // matched language prefix. An absolute `http(s)` target already leaves the
      // app and is emitted verbatim, so the flag cannot change anything there —
      // its presence can only be a misunderstanding of what it does. Rejected
      // rather than ignored, so the author learns at `sovrium validate` instead of
      // shipping a config carrying a flag that does nothing.
      //
      // Both values are rejected, not just `false`: `localizeTarget: true` on an
      // absolute target is equally inert, and accepting it would teach that the
      // flag means something here.
      const inertFlag = rules.find(
        (rule) => rule.localizeTarget !== undefined && isAbsoluteRedirectTarget(rule.to)
      )
      return inertFlag === undefined
        ? true
        : `Redirect '${inertFlag.from}' sets 'localizeTarget' on the absolute target '${inertFlag.to}' — an absolute URL leaves the app and is always emitted verbatim, so the flag has no effect. Remove 'localizeTarget', or point the rule at a root-relative path.`
    })
  ),
  Schema.check(
    Schema.makeFilter((rules) => {
      const cycleEntry = findCycleEntry(rules)
      return cycleEntry === undefined
        ? true
        : `Redirect cycle detected starting at '${cycleEntry}' — following the rules returns to a path already visited, which loops the browser forever`
    })
  )
)

/**
 * TypeScript type inferred from RedirectSchema (a single rule).
 * @public
 */
export type Redirect = Schema.Schema.Type<typeof RedirectSchema>

/**
 * TypeScript type inferred from RedirectsSchema.
 * @public
 */
export type Redirects = Schema.Schema.Type<typeof RedirectsSchema>

/**
 * Encoded type of RedirectsSchema (what goes in).
 * @public
 */
export type RedirectsEncoded = Schema.Codec.Encoded<typeof RedirectsSchema>
