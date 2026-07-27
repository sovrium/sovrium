/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const RedirectFromSchema = Schema.String.pipe(
  Schema.pattern(/^\/[^\s?#]*$/, {
    message: () =>
      "redirect 'from' must be a root-relative path starting with '/' and must not contain whitespace, '?' or '#'",
  }),
  Schema.annotations({
    description:
      "Root-relative path to redirect FROM (e.g. '/products/platform'). Matched locale-agnostically unless it already begins with a configured language segment.",
  })
)

const RedirectToSchema = Schema.String.pipe(
  Schema.pattern(/^(?:\/(?!\/)[^\s#]*|https?:\/\/[^\s]+)$/, {
    message: () =>
      "redirect 'to' must be a root-relative path starting with a single '/' or an absolute http(s) URL (protocol-relative '//host' targets are rejected as open redirects)",
  }),
  Schema.annotations({
    description:
      "Redirect target — a root-relative path (e.g. '/') or an absolute http(s) URL. A path target inherits the request's language prefix; an absolute URL is used verbatim.",
  })
)

const RedirectLocalizeTargetSchema = Schema.Boolean.pipe(
  Schema.annotations({
    description:
      "Whether a root-relative target inherits the language prefix matched by 'from' (default: true). Set false when the target lives outside the locale namespace (e.g. '/_admin/login'), so it is emitted verbatim.",
  })
)

const RedirectStatusSchema = Schema.Literal(301, 302, 307, 308).pipe(
  Schema.annotations({
    description: 'HTTP redirect status code. Defaults to 301 (Moved Permanently) when omitted.',
  })
)

export const RedirectSchema = Schema.Struct({
  from: RedirectFromSchema,
  to: RedirectToSchema,
  status: Schema.optional(RedirectStatusSchema),
  localizeTarget: Schema.optional(RedirectLocalizeTargetSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Redirect',
    title: 'Redirect Rule',
    description:
      'A single URL redirect: the retired path, its replacement, and the HTTP status to answer with.',
    examples: [{ from: '/products/platform', to: '/', status: 301 as const }],
  })
)

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

export const isAbsoluteRedirectTarget = (to: string): boolean =>
  to.startsWith('http://') || to.startsWith('https://')

const toComparablePath = (to: string): string | undefined => {
  if (!to.startsWith('/')) return undefined
  const withoutHash = to.split('#')[0] ?? ''
  const withoutQuery = withoutHash.split('?')[0] ?? ''
  return withoutQuery === '' ? '/' : withoutQuery
}

const findCycleEntry = (
  rules: ReadonlyArray<{ readonly from: string; readonly to: string }>
): string | undefined => {
  const targets = new Map(rules.map((rule) => [rule.from, toComparablePath(rule.to)]))

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

export const RedirectsSchema = Schema.Array(RedirectSchema).pipe(
  Schema.minItems(1, {
    message: () => 'redirects must declare at least one redirect rule when present',
  }),
  Schema.annotations({
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
  Schema.filter((rules) => {
    const duplicate = rules.find(
      (rule, index) => rules.findIndex((other) => other.from === rule.from) !== index
    )
    return duplicate === undefined
      ? true
      : `Duplicate redirect 'from' path '${duplicate.from}' — each path may declare at most one redirect`
  }),
  Schema.filter((rules) => {
    const selfRedirect = rules.find((rule) => rule.from === toComparablePath(rule.to))
    return selfRedirect === undefined
      ? true
      : `Redirect '${selfRedirect.from}' points at itself — a self-redirect loops forever`
  }),
  Schema.filter((rules) => {
    const inertFlag = rules.find(
      (rule) => rule.localizeTarget !== undefined && isAbsoluteRedirectTarget(rule.to)
    )
    return inertFlag === undefined
      ? true
      : `Redirect '${inertFlag.from}' sets 'localizeTarget' on the absolute target '${inertFlag.to}' — an absolute URL leaves the app and is always emitted verbatim, so the flag has no effect. Remove 'localizeTarget', or point the rule at a root-relative path.`
  }),
  Schema.filter((rules) => {
    const cycleEntry = findCycleEntry(rules)
    return cycleEntry === undefined
      ? true
      : `Redirect cycle detected starting at '${cycleEntry}' — following the rules returns to a path already visited, which loops the browser forever`
  })
)

export type Redirect = Schema.Schema.Type<typeof RedirectSchema>

export type Redirects = Schema.Schema.Type<typeof RedirectsSchema>

export type RedirectsEncoded = Schema.Schema.Encoded<typeof RedirectsSchema>
