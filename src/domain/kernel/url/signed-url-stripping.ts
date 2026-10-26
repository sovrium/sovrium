/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A URL as it may be RECORDED — in a committed file, a log line, a terminal —
 * once everything that authorises its bearer has been taken out of it.
 *
 * A signed link is a credential: whoever holds the whole URL can fetch what it
 * points at until it expires, and some never do. So a URL that is fetched
 * exactly as given still must not be written down as given. This is the one
 * place that decides what "as given, minus the credential" means.
 *
 * @public
 */
export interface StrippedUrl {
  /** The URL with its signing parameters, userinfo and fragment removed. */
  readonly url: string
  /** True when a signing parameter or a userinfo credential had to be taken out. */
  readonly signed: boolean
}

/**
 * Remove from `rawUrl` every part that authorises its bearer.
 *
 * Contract (pinned by the co-located table of cases):
 *
 * - **Query parameters are matched by NAME**, case-insensitively, after
 *   percent-decoding the name, and exactly: `tokenizer` is not `token`.
 *   - Always removed: any name starting `x-amz-` (AWS SigV4) or `x-goog-`
 *     (Google Cloud Storage V4); `AWSAccessKeyId` and `GoogleAccessId` (the V2
 *     identities); `Key-Pair-Id` (CloudFront); and the generic `signature`,
 *     `sig`, `expires`, `token`, `access_token`, `auth`, `apikey`, `api_key`
 *     and `key`.
 *   - Removed only beside a `sig` (an Azure SAS token): `sv`, `ss`, `srt`,
 *     `sr`, `sp`, `se`, `st`, `sip`, `spr`, `si`, `sdd`, `skoid`, `sktid`,
 *     `skt`, `ske`, `sks`, `skv`, `saoid`, `suoid`, `scid`, `ses`. Alone, `sv`
 *     is an ordinary parameter (a version, a view) and is kept.
 *   - Removed only beside a `Key-Pair-Id` (a CloudFront custom policy):
 *     `policy`.
 * - **Every other parameter is kept**, byte for byte as written and in its
 *   original order. When none is left, the `?` goes too.
 * - **Userinfo is removed** (`https://user:pass@host/…`) and counts as signed.
 * - **The fragment is removed** and does NOT count as signed: it is never sent
 *   to the server, so it is not part of what was fetched.
 * - **Nothing to remove** returns the input string unchanged, never a
 *   re-serialised copy.
 * - **An input that does not parse as a URL** fails closed: everything from the
 *   first `?` or `#` is dropped, and `signed` is true when a non-empty query
 *   was among it — an unknown query cannot be shown to be harmless.
 *
 * `key` is in the generic list on purpose. It is the Google API key parameter
 * and the common spelling of a bearer key elsewhere, and the costs are not
 * symmetric: removing a harmless `key` costs the recorded URL a parameter it
 * can no longer be re-fetched without — which `signed: true` says out loud —
 * while keeping a secret one commits a credential to a repository for good.
 *
 * @public
 */
export const stripSigningFromUrl = (rawUrl: string): StrippedUrl => {
  const { head, query, hasFragment } = splitUrl(rawUrl)
  const parsed = URL.parse(rawUrl)
  if (parsed === null) return { url: head, signed: query !== '' }

  const kept = keptParameters(query)
  const hasUserinfo = parsed.username !== '' || parsed.password !== ''
  const removedParameter = kept !== query
  if (!removedParameter && !hasUserinfo && !hasFragment) return { url: rawUrl, signed: false }

  const recordedHead = hasUserinfo ? withoutUserinfo(head) : head
  return {
    url: kept === '' ? recordedHead : `${recordedHead}?${kept}`,
    signed: removedParameter || hasUserinfo,
  }
}

/** The text before the query, the query text without its `?`, and whether a fragment followed. */
const splitUrl = (
  rawUrl: string
): { readonly head: string; readonly query: string; readonly hasFragment: boolean } => {
  const hashAt = rawUrl.indexOf('#')
  const beforeFragment = hashAt === -1 ? rawUrl : rawUrl.slice(0, hashAt)
  const queryAt = beforeFragment.indexOf('?')
  return {
    head: queryAt === -1 ? beforeFragment : beforeFragment.slice(0, queryAt),
    query: queryAt === -1 ? '' : beforeFragment.slice(queryAt + 1),
    hasFragment: hashAt !== -1,
  }
}

/**
 * The query text with every signing parameter taken out, the rest kept as
 * written and in order. The SAME string when nothing was taken out.
 */
const keptParameters = (query: string): string => {
  if (query === '') return query
  const pairs = query.split('&')
  const names = pairs.map(parameterName)
  const azureSas = names.includes('sig')
  const cloudFrontPolicy = names.includes('key-pair-id')
  const kept = pairs.filter(
    (_, index) => !isSigning(names[index] ?? '', azureSas, cloudFrontPolicy)
  )
  return kept.length === pairs.length ? query : kept.join('&')
}

/** Removed wherever they appear. */
const ALWAYS_SIGNING: ReadonlySet<string> = new Set([
  'awsaccesskeyid',
  'googleaccessid',
  'key-pair-id',
  'signature',
  'sig',
  'expires',
  'token',
  'access_token',
  'auth',
  'apikey',
  'api_key',
  'key',
])

/** The Azure SAS fields, removed only beside a `sig`. */
const AZURE_SAS_FIELDS: ReadonlySet<string> = new Set([
  'sv',
  'ss',
  'srt',
  'sr',
  'sp',
  'se',
  'st',
  'sip',
  'spr',
  'si',
  'sdd',
  'skoid',
  'sktid',
  'skt',
  'ske',
  'sks',
  'skv',
  'saoid',
  'suoid',
  'scid',
  'ses',
])

/**
 * A parameter's name, percent-decoded and lower-cased, for matching only.
 *
 * Decodes `%XX` one byte at a time rather than through `decodeURIComponent`,
 * which throws on a malformed sequence: every name matched here is ASCII, so a
 * byte-wise decode is exact for them and harmless for the rest.
 */
const parameterName = (pair: string): string => {
  const equalsAt = pair.indexOf('=')
  const raw = equalsAt === -1 ? pair : pair.slice(0, equalsAt)
  return raw
    .replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .toLowerCase()
}

const isSigning = (name: string, azureSas: boolean, cloudFrontPolicy: boolean): boolean =>
  name.startsWith('x-amz-') ||
  name.startsWith('x-goog-') ||
  ALWAYS_SIGNING.has(name) ||
  (azureSas && AZURE_SAS_FIELDS.has(name)) ||
  (cloudFrontPolicy && name === 'policy')

/**
 * `scheme://user:pass@host/path` without its `user:pass@`, on the text as
 * written so the rest of it is not re-serialised. The authority ends at the
 * first `/` after the `//`; its LAST `@` closes the userinfo.
 */
const withoutUserinfo = (head: string): string => {
  const authorityAt = head.indexOf('//')
  if (authorityAt === -1) return head
  const start = authorityAt + 2
  const pathAt = head.indexOf('/', start)
  const end = pathAt === -1 ? head.length : pathAt
  const atSign = head.lastIndexOf('@', end - 1)
  return atSign < start ? head : `${head.slice(0, start)}${head.slice(atSign + 1)}`
}
