/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the bytes of `sovrium init --from-bundle <source>` come from: an
 * `https:` URL, a `file:` URL or a local path, read into memory under the
 * 25 MiB compressed cap and recognised as a bundle — or refused, before a
 * single byte is written anywhere.
 *
 * ### Recognising a bundle
 *
 * The first signal that answers decides, in this order:
 *
 * 1. the PATHNAME of the final URL after redirects (or the local file name):
 *    `.tar.gz` / `.tgz` is a bundle, `.yaml` / `.yml` / `.json` a document.
 *    Only the pathname is read, never the query, so a signed query string
 *    cannot confuse it; and it is the publisher's stated intent, free to read;
 * 2. the gzip magic bytes `1f 8b`, because a signed bucket URL routinely
 *    answers `application/octet-stream`;
 * 3. the `Content-Type`, `application/gzip` or `application/x-gzip`.
 *
 * A document is refused with a pointer to `--from-url`. Something recognised
 * as a bundle that does not gunzip is refused later, by the archive reader.
 *
 * ### The fetch
 *
 * Through `fetchFollowingRedirects`, unchanged: at most five hops, each
 * re-checked for https and SSRF, each with a deadline. A redirect chain is the
 * normal case: a short link, then a webhook, then a signed bucket URL. The
 * first address is put through the same SSRF guard before any socket opens.
 * The body is counted while it streams, never trusting `Content-Length`, and
 * abandoned the moment it crosses 25 MiB or its deadline.
 */

import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { printableUrl } from '@/cli/commands/init-from-url-provenance'
import { contentDispositionFileName } from '@/domain/kernel/format/content-disposition'
import { fetchFollowingRedirects } from '@/infrastructure/egress/follow-redirects'
import {
  isPrivateOutboundHost,
  validateOutboundUrl,
} from '@/infrastructure/egress/validate-outbound-url'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { isPrivateOutboundOptIn } from '@/infrastructure/process/security-posture'

/** The compressed cap: about ten times the largest starter, four times under a host's stored cap. */
const BUNDLE_MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024

/** Deadline for the response headers of each hop. */
const HEADERS_TIMEOUT_MS = 20_000

/** Deadline for the whole body: 25 MiB in about ten seconds on a modest line, with room to spare. */
const BODY_TIMEOUT_MS = 120_000

/** A step of the import that either answers or refuses, with the reason a person reads. */
export type Step<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string }

export const refuse = <T>(reason: string): Step<T> => ({ ok: false, reason })

/** The bytes of a source, and what a reader needs to know about where they came from. */
export interface BundleSource {
  readonly bytes: Uint8Array
  /** The `host[:port]` of the final URL, `undefined` for a file or a local path. */
  readonly host: string | undefined
  /** The archive's file name, for the temporary copy `--inspect` keeps. */
  readonly fileName: string
  /**
   * The final URL's host as `URL.hostname` gives it, `undefined` for a file or a
   * local path. What the publisher-key test seam is judged by: only a loopback
   * IP literal qualifies, and a name is never looked up.
   */
  readonly hostname: string | undefined
}

const BUNDLE_PATH = /\.(?:tar\.gz|tgz)$/i
const DOCUMENT_PATH = /\.(?:ya?ml|json)$/i
const GZIP_TYPES: ReadonlySet<string> = new Set(['application/gzip', 'application/x-gzip'])

const CAP_REFUSAL =
  'is over the 25 MiB limit for a bundle, so the read was abandoned. A starter is a config, a seed and a few images; a bigger app is a git clone, not a link.'

const documentRefusal = (source: string): string =>
  `${source} is a config document, not a bundle. Fork it with --from-url instead:\n` +
  `  sovrium init <dir> --from-url ${source}`

/** Whether the bytes open with the gzip magic number. */
const isGzip = (bytes: Uint8Array): boolean => bytes[0] === 0x1f && bytes[1] === 0x8b

/** Decide, from the pathname, the bytes and the content type, in that order. */
const recognise = (
  pathname: string,
  bytes: Uint8Array,
  contentType: string | undefined,
  source: string
): Step<true> => {
  if (BUNDLE_PATH.test(pathname)) return { ok: true, value: true }
  if (DOCUMENT_PATH.test(pathname)) return refuse(documentRefusal(source))
  if (isGzip(bytes)) return { ok: true, value: true }
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  return GZIP_TYPES.has(type)
    ? { ok: true, value: true }
    : refuse(`${source} is not a bundle: it is not a .tar.gz archive, and its bytes are not gzip.`)
}

/**
 * Pull chunks until the end, the cap or the deadline. Recursive, so the
 * running count is a parameter rather than mutable state.
 */
const pullCapped = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: readonly Uint8Array[],
  total: number
): Promise<Uint8Array | 'over-cap'> => {
  const { done, value } = await reader.read()
  if (done) return new Uint8Array(Buffer.concat(chunks))
  const next = total + value.byteLength
  if (next > BUNDLE_MAX_DOWNLOAD_BYTES) {
    await reader.cancel().catch(() => undefined)
    return 'over-cap'
  }
  return pullCapped(reader, [...chunks, value], next)
}

/** Read a body under the cap and the body deadline. */
const readBody = async (response: Response, source: string): Promise<Step<Uint8Array>> => {
  if (response.body === null) return { ok: true, value: new Uint8Array() }
  const reader = response.body.getReader()
  const deadline = setTimeout(() => void reader.cancel().catch(() => undefined), BODY_TIMEOUT_MS)
  try {
    const read = await pullCapped(reader, [], 0)
    return read === 'over-cap' ? refuse(`${source} ${CAP_REFUSAL}`) : { ok: true, value: read }
  } catch (error) {
    return refuse(
      `Could not read ${source}: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    clearTimeout(deadline)
  }
}

/** Plain `http` only for a private or loopback host under the opt-out, as `--from-url` rules. */
const schemeRefusal = (url: URL, source: string): string | undefined => {
  if (url.protocol === 'https:') return undefined
  if (url.protocol === 'http:' && isPrivateOutboundOptIn() && isPrivateOutboundHost(url.hostname)) {
    return undefined
  }
  return `--from-bundle requires an https:// address, and "${source}" is not one.\nA bundle becomes your whole project, so it is fetched over TLS or not at all.`
}

/** Why the first address may not be dialled at all, or `undefined`: checked before any socket opens. */
const preflightRefusal = (url: URL, source: string, shown: string): string | undefined => {
  const insecure = schemeRefusal(url, shown)
  if (insecure !== undefined) return insecure
  if (process.env.SOVRIUM_DISABLE_NETWORK === '1') {
    return '--from-bundle requires network access for a URL, and SOVRIUM_DISABLE_NETWORK is set.'
  }
  const validation = validateOutboundUrl(source)
  return validation.ok
    ? undefined
    : `Blocked outbound bundle URL ${shown}: ${validation.issue.reason} targets are not allowed ` +
        `(SSRF guard).\nSet SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1 to permit private/loopback targets.`
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Follow the redirect chain to a response that answered 2xx, or refuse. */
const fetchResponse = async (
  url: URL,
  source: string,
  shown: string
): Promise<Step<{ readonly response: Response; readonly final: URL }>> => {
  const fetched = await fetchFollowingRedirects(url, HEADERS_TIMEOUT_MS).catch(
    (error: unknown) =>
      ({
        ok: false,
        message: `Could not fetch ${shown}: ${errorText(error).replaceAll(source, shown)}`,
      }) as const
  )
  if (!fetched.ok) return refuse(fetched.message)
  const { response, finalUrl } = fetched
  if (response.ok) return { ok: true, value: { response, final: new URL(finalUrl) } }
  await response.body?.cancel().catch(() => undefined)
  return refuse(`Could not fetch ${shown}: HTTP ${String(response.status)}`)
}

/**
 * Fetch a bundle from the network. `source` is dialled exactly as given, and
 * every message names `shown` instead: a signed link's signature never reaches
 * the terminal.
 */
const fetchSource = async (url: URL, source: string): Promise<Step<BundleSource>> => {
  const shown = printableUrl(source)
  const preflight = preflightRefusal(url, source, shown)
  if (preflight !== undefined) return refuse(preflight)
  const fetched = await fetchResponse(url, source, shown)
  if (!fetched.ok) return fetched
  const { response, final } = fetched.value
  // The pathname alone can already say "document": refuse before reading the body.
  if (DOCUMENT_PATH.test(final.pathname)) {
    await response.body?.cancel().catch(() => undefined)
    return refuse(documentRefusal(shown))
  }
  const body = await readBody(response, shown)
  if (!body.ok) return body
  const type = response.headers.get('content-type') ?? undefined
  const recognised = recognise(final.pathname, body.value, type, shown)
  if (!recognised.ok) return recognised
  // The server's own name first: a signed storage path often names nothing
  // (`/…/signed?path=…`). The query is never read.
  const fileName =
    contentDispositionFileName(response.headers.get('content-disposition')) ??
    (basename(final.pathname) || 'bundle.tar.gz')
  return {
    ok: true,
    value: { bytes: body.value, host: final.host, fileName, hostname: final.hostname },
  }
}

/** Read a bundle from a local path. */
const readLocal = async (path: string, source: string): Promise<Step<BundleSource>> => {
  const info = await stat(path).catch(() => undefined)
  if (info === undefined || !info.isFile())
    return refuse(`${source} is not a file this command can read.`)
  if (DOCUMENT_PATH.test(path)) return refuse(documentRefusal(source))
  if (info.size > BUNDLE_MAX_DOWNLOAD_BYTES) return refuse(`${source} ${CAP_REFUSAL}`)
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
  const recognised = recognise(path, bytes, undefined, source)
  if (!recognised.ok) return recognised
  return {
    ok: true,
    value: { bytes, host: undefined, fileName: basename(path), hostname: undefined },
  }
}

/** Read `source` — an `https:` URL, a `file:` URL or a local path — into a recognised bundle. */
export const readBundleSource = async (source: string): Promise<Step<BundleSource>> => {
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(source) ? URL.parse(source) : null
  if (url === null) return readLocal(source, source)
  if (url.protocol === 'file:') return readLocal(fileURLToPath(url), printableUrl(source))
  return fetchSource(url, source)
}

/**
 * `--from-url` given a bundle's address: point to `--from-bundle`, before any
 * request is made. Returns the URL untouched when its pathname is not a bundle.
 */
export const assertNotABundleUrl = (rawUrl: string): string => {
  const pathname = URL.parse(rawUrl)?.pathname ?? ''
  if (!BUNDLE_PATH.test(pathname)) return rawUrl
  const shown = printableUrl(rawUrl)
  printStderr(
    `Error: ${shown} is a bundle, not a config document. Open it with --from-bundle instead:\n` +
      `  sovrium init <dir> --from-bundle ${shown}`
  )
  return process.exit(1)
}
