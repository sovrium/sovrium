/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init --from-url <https://…>` — fork ONE published config document.
 *
 * `--template owner/repo` fetches a whole repository. This fetches a single
 * YAML or JSON config: the shape a gallery, a blog post or a colleague can
 * publish without owning a repository, and the shape a shell hands `init` when
 * somebody pastes a link.
 *
 * ### A fork, not a link
 *
 * Fetched exactly once, at scaffold time, and written into the project as an
 * ordinary config the user then owns. Nothing re-fetches it, ever. That is the
 * difference between a file somebody has and a file whose author can still
 * change what their app does.
 *
 * ### Everything it refuses, and why
 *
 * - **Plain `http`** — the document becomes the whole application, so an
 *   on-path attacker who can rewrite it chooses what the project is. The one
 *   relaxation is `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, the existing "I accept an
 *   unguarded, non-public outbound target" switch, which is also what makes a
 *   loopback fixture reachable at all.
 * - **A remote `.ts` config** — a TypeScript config is a PROGRAM. Fetching one
 *   from a URL and running it is a different product with a different threat
 *   model, so the refusal says that rather than complaining about a format.
 * - **Anything over 1 MB** — a config document is a few KB. An unbounded read
 *   at scaffold time is a memory exhaustion whose size the publisher picks.
 * - **A remote `$ref`** — following it makes the fork partial, the project
 *   unreproducible, and every later boot dependent on a host the user never
 *   chose, which is precisely what a fork is not.
 * - **A document AppSchema rejects** — decode BEFORE the first write. A
 *   half-scaffolded project whose config does not boot is worse than no
 *   project, because the user now has to work out which files to delete.
 */

import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { detectFormatFromUrl } from '@/domain/kernel/config-parsing/format-detection'
import { parseSchemaContent } from '@/domain/models/app/app-content-parsing'
import { fetchFollowingRedirects } from '@/infrastructure/egress/follow-redirects'
import {
  isPrivateOutboundHost,
  validateOutboundUrl,
} from '@/infrastructure/egress/validate-outbound-url'
import { printStderr } from '@/infrastructure/logging/cli-output'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

/** Deadline for the fetch. A config document is a few KB over HTTPS. */
const FETCH_TIMEOUT_MS = 15_000

/**
 * Hard ceiling on the fetched document.
 *
 * Applied to the bytes actually read, not to `Content-Length`: a header is the
 * publisher's claim about the body, and a chunked response carries none at all.
 */
const MAX_CONFIG_BYTES = 1024 * 1024

/** The provenance sidecar written beside a forked config. */
export const PROVENANCE_FILENAME = '.sovrium-template.json'

const fail = (message: string): never => {
  printStderr(`Error: ${message}`)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * Whether plain `http` is acceptable for this host.
 *
 * TWO conditions, and both are load-bearing. The operator must have opted out
 * of the SSRF guard, AND the target must be a private or loopback host — which
 * is what the opt-out is FOR. The flag alone is not enough: the E2E harness
 * sets it globally so its local fixtures are reachable, and a rule that read
 * only the flag would quietly allow `http://example.com` under it. A published
 * config fetched over cleartext from the public internet is chosen by whoever
 * is on the path, not by its author.
 */
const allowsPlainHttp = (hostname: string): boolean =>
  process.env.SOVRIUM_ALLOW_PRIVATE_OUTBOUND === '1' && isPrivateOutboundHost(hostname)

/** A published document resolved into the bytes and name it will be written as. */
export interface ForkedConfig {
  /** The URL it came from, recorded verbatim in the provenance sidecar. */
  readonly source: string
  /** `app.yaml` or `app.json` — the project's config filename. */
  readonly filename: string
  /** The published bytes, unmodified. */
  readonly content: string
  /** sha256 of those exact bytes. */
  readonly sha256: string
}

/**
 * Refuse a URL this command will not fork, and name the file it would write.
 *
 * PURE and network-free, so the two refusals it owns happen before a request
 * is made and therefore before anything can be written.
 *
 * @public
 */
export const assertForkableUrl = (rawUrl: string): { readonly filename: string } => {
  const parsed = URL.parse(rawUrl)
  if (!parsed) {
    return fail(`--from-url expects a URL, and "${rawUrl}" is not one. Use an https:// address.`)
  }

  const plainHttpOk = parsed.protocol === 'http:' && allowsPlainHttp(parsed.hostname)
  if (parsed.protocol !== 'https:' && !plainHttpOk) {
    return fail(
      `--from-url requires an https:// address, and "${rawUrl}" is not one.\n` +
        `This document becomes your whole application, so it is fetched over TLS or not at all.`
    )
  }

  // `.ts` is checked on the PATH rather than through `detectFormatFromUrl`,
  // because the refusal has to fire for a TypeScript config whatever the
  // server would have claimed the content type was.
  if (/\.(ts|mts)$/i.test(parsed.pathname)) {
    return fail(
      `--from-url will not fetch a .ts config from "${rawUrl}".\n` +
        `A TypeScript config is a program, and downloading a program from a URL to execute it\n` +
        `is a different thing from copying a document. Fork a .yaml or .json config instead, or\n` +
        `download the .ts file yourself, read it, and place it in the project by hand.`
    )
  }

  const format = detectFormatFromUrl(rawUrl)
  if (format !== 'json' && format !== 'yaml') {
    return fail(
      `--from-url expects the URL to end in .yaml, .yml or .json, and "${rawUrl}" does not.\n` +
        `The extension is what decides whether the fork lands as app.yaml or app.json.`
    )
  }

  return { filename: format === 'json' ? 'app.json' : 'app.yaml' }
}

/** The text pulled so far, and whether the limit was crossed. @public */
export interface CappedRead {
  readonly text: string
  readonly overflowed: boolean
}

/**
 * Pull one chunk, then decide. Recursive rather than a loop so the running byte
 * count is a parameter instead of mutable state.
 *
 * Decoding INCREMENTALLY (`stream: true`) rather than concatenating the chunks and
 * decoding once: it avoids holding the bytes and the string at the same time, and
 * it keeps a multi-byte character split across a chunk boundary intact, which a
 * per-chunk `decode()` would turn into two replacement characters.
 */
const pullCapped = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  text: string,
  bytes: number
): Promise<CappedRead> => {
  const { done, value } = await reader.read()
  if (done) return { text: text + decoder.decode(), overflowed: false }

  const total = bytes + value.byteLength
  // STOP HERE — before appending, and before asking for another chunk. The
  // chunk that crosses the line is the last one read.
  if (total > MAX_CONFIG_BYTES) {
    // eslint-disable-next-line functional/no-expression-statements -- releasing the socket is the whole point of stopping here; there is no value to thread
    await reader.cancel().catch(() => undefined)
    return { text, overflowed: true }
  }

  return pullCapped(reader, decoder, text + decoder.decode(value, { stream: true }), total)
}

/**
 * Read at most `MAX_CONFIG_BYTES` from a body, WHILE STREAMING rather than after.
 *
 * `response.arrayBuffer()` buffers the whole body before anything can be measured,
 * so a publisher aiming a multi-gigabyte response at `--from-url` exhausted memory
 * before the check it was going to fail ever ran — the cap described a refusal
 * that arrived too late to be one.
 *
 * Separated from the refusal below so the limit is testable: this returns a
 * verdict, `readCappedText` turns one into an exit.
 *
 * @public
 */
export const readCappedStream = async (body: ReadableStream<Uint8Array>): Promise<CappedRead> =>
  pullCapped(body.getReader(), new TextDecoder(), '', 0)

/**
 * Read the fetched document, or refuse it for being too large.
 *
 * The refusal names the limit rather than the size, deliberately: reading stopped
 * at the chunk that crossed 1 MB, so the total is not known here and stating one
 * would mean buffering the body to find it out — which is the thing this no longer
 * does.
 */
const readCappedText = async (response: Response, rawUrl: string): Promise<string> => {
  const { body } = response
  if (body === null) return ''

  const read = await readCappedStream(body)
  if (read.overflowed) {
    return fail(
      `The document at ${rawUrl} is over the 1 MB limit for a config fetched with --from-url,\n` +
        `so the read was abandoned. A config document is a few kilobytes; this is not one.`
    )
  }
  return read.text
}

/** Every `$ref` value in the document, at any depth. */
const collectRefValues = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectRefValues)
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    key === '$ref' && typeof value === 'string' ? [value] : collectRefValues(value)
  )
}

/** Refuse a document that points at another host to be complete. */
const assertNoRemoteRefs = (parsed: unknown, rawUrl: string): void => {
  const remote = collectRefValues(parsed).filter((ref) => /^https?:\/\//i.test(ref))
  if (remote.length === 0) return
  return fail(
    `The config at ${rawUrl} carries a remote $ref: ${remote[0]}\n` +
      `--from-url copies one document into your project. Following that $ref would leave the\n` +
      `fork incomplete and every later boot dependent on a host you did not choose, so it is\n` +
      `refused. Ask the publisher for a single self-contained document.`
  )
}

/** One finding as a report line, in the shape the prose report uses. */
const findingLine = (finding: ConfigFinding): string =>
  finding.path === '' ? `  ${finding.message}` : `  ${finding.message}\n    at ${finding.path}`

/**
 * Refuse a document AppSchema does not accept, naming what it objected to.
 *
 * ## Why this prints `findings` where every other caller prints `errors`
 *
 * This is the one decode in the product whose input is somebody ELSE's document.
 * `reportInput: true` is justified at its call site because "the input is the
 * operator's own config file", and the comment on that option says in as many
 * words: do not copy this to a decode whose input comes from an untrusted body.
 * Here the bytes came from a URL a stranger published, so a publisher who controls
 * them controls what a refusal prints into the operator's terminal and CI log —
 * their own `env:` value included.
 *
 * `findings` is the same refusal with the rejected value already stripped (THE
 * ECHO RULE in `app-excess-property-report.ts`), so this reaches for it rather
 * than re-deriving a second strip that could come to disagree with it. What is
 * lost is the value, which is not the operator's to see; what is kept is the
 * complaint, the expected shape and the position — and an unknown component type
 * is still named, because that value was checked against a closed list.
 */
const assertDecodes = async (parsed: unknown, rawUrl: string): Promise<void> => {
  // Imported lazily, exactly as `validate.ts` does: the decode pipeline pulls
  // in the whole of `AppSchema`, and an `init` that never forks a URL should
  // not pay for it.
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const result = decodeAppConfigObject(parsed)
  if (result.valid) return
  return fail(
    `The config at ${rawUrl} is not valid, so nothing was created.\n\n` +
      result.findings.map(findingLine).join('\n')
  )
}

/**
 * Fetch, check and hash the published document. Writes nothing.
 *
 * Every refusal exits 1 before the caller creates a single file, which is what
 * makes "a rejected fork leaves nothing behind" true by construction rather
 * than by a cleanup path that has to be right.
 *
 * @public
 */
export const fetchForkedConfig = async (
  rawUrl: string,
  filename: string
): Promise<ForkedConfig> => {
  if (process.env.SOVRIUM_DISABLE_NETWORK === '1') {
    return fail(
      `--from-url requires network access, and SOVRIUM_DISABLE_NETWORK is set — nothing was created.`
    )
  }

  const validation = validateOutboundUrl(rawUrl)
  if (!validation.ok) {
    return fail(
      `Blocked outbound config URL ${rawUrl}: ${validation.issue.reason} targets are not allowed ` +
        `(SSRF guard).\nSet SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1 to permit private/loopback targets.`
    )
  }

  // Redirects are FOLLOWED — `raw.githubusercontent.com` answers a 302, so every
  // published gallery link has one — but each hop is re-decided against the same
  // rules this function just applied to the URL the operator typed. Without that,
  // the document that becomes the whole project is chosen by whoever controls the
  // last hop. See `follow-redirects.ts`.
  const fetched = await fetchFollowingRedirects(validation.url, FETCH_TIMEOUT_MS).catch(
    (error: unknown) =>
      fail(`Could not fetch ${rawUrl}: ${error instanceof Error ? error.message : String(error)}`)
  )
  if (!fetched.ok) {
    return fail(fetched.message)
  }
  const { response } = fetched
  if (!response.ok) {
    return fail(`Could not fetch ${rawUrl}: HTTP ${response.status}`)
  }

  const content = await readCappedText(response, rawUrl)

  const parsed = ((): unknown => {
    try {
      return parseSchemaContent(content, filename.endsWith('.json') ? 'json' : 'yaml')
    } catch (error) {
      return fail(
        `Could not parse the config at ${rawUrl}: ` +
          (error instanceof Error ? error.message : String(error))
      )
    }
  })()

  // Before the decode: a remote `$ref` is a shape AppSchema would reject for
  // an unrelated reason, and the reason matters more than the rejection.
  assertNoRemoteRefs(parsed, rawUrl)
  await assertDecodes(parsed, rawUrl)

  return {
    source: rawUrl,
    filename,
    content,
    sha256: createHash('sha256').update(Buffer.from(content, 'utf-8')).digest('hex'),
  }
}

/**
 * Write the forked config verbatim, plus the provenance sidecar.
 *
 * BYTE-FOR-BYTE, never re-serialised through a YAML writer. An AI is about to
 * edit this file, and the comments explaining it are most of what makes that
 * possible — a round-trip through a serialiser strips every one of them and
 * reorders the keys for good measure.
 *
 * Provenance goes in a sidecar rather than a header comment: a comment does not
 * survive the first rewrite, and a JSON config cannot carry one at all. The
 * file is meant to be committed — it is also what lets a shell offer "reset to
 * the template I started from".
 *
 * @public
 */
export const writeForkedConfig = async (
  forked: ForkedConfig,
  targetDir: string
): Promise<readonly string[]> => {
  const configPath = join(targetDir, forked.filename)
  await writeFile(configPath, forked.content)

  const provenancePath = join(targetDir, PROVENANCE_FILENAME)
  await writeFile(
    provenancePath,
    `${JSON.stringify(
      {
        source: forked.source,
        sha256: forked.sha256,
        file: forked.filename,
        fetchedAt: new Date().toISOString(),
      },
      undefined,
      2
    )}\n`
  )

  return [configPath, provenancePath]
}
