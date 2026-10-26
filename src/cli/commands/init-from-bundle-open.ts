/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Judge the bytes of a bundle before any of it is written, in the pipeline
 * order [internal ref] A1 fixes. Every step is a refusal, and this module writes
 * nothing at all:
 *
 * 1. inflate under the 100 MiB bound (`gunzipBounded`), the host's stored cap
 *    reused as the decompression-bomb bound;
 * 2. read EVERY tar header (`readTarEntries`), symlinks and devices included,
 *    and refuse what must never land on disk (`bundleEntryRefusal`,
 *    `caseCollisions`), each by path;
 * 3. check every entry against the manifest (`verifyBundle`): size, sha256,
 *    nothing unlisted, `configHash`. A mismatch is refused, never a warning;
 * 4. judge the publisher (`bundlePublisherVerdict`): a signature that does not
 *    verify is refused, an unknown key or no signature reads unverified;
 * 5. refuse a manifest from a newer engine, then decode the config with the
 *    decoder `validate` uses, printing the findings without the rejected
 *    values: these bytes came from somebody else.
 */

import { createHash } from 'node:crypto'
import { Option, Schema } from 'effect'
import {
  BUNDLE_CONFIG_ENTRY,
  BUNDLE_MANIFEST_ENTRY,
  bundleManifestSchema,
  type BundleManifest,
} from '@/application/use-cases/server/bundle-manifest'
import { verifyBundle } from '@/application/use-cases/server/bundle-verification'
import { BUNDLE_MAX_STORED_BYTES, gunzipBounded } from '@/domain/kernel/format/bounded-gunzip'
import { readTarEntries, type TarEntry } from '@/domain/kernel/format/tar-entries'
import {
  bundleEntryRefusal,
  caseCollisions,
  type BundleEntryRefusal,
} from '@/domain/kernel/identity/bundle-entry-refusal'
import {
  bundlePublisherVerdict,
  type BundlePublisherVerdict,
} from '@/domain/kernel/identity/bundle-publisher'
import { compareVersions } from '@/domain/kernel/markdown/release-notes-selection'
import { resolveBundlePublisherKeys } from '@/domain/models/process-env/bundle-publisher-keys'
import { isSsrfRelaxed } from '@/infrastructure/process/security-posture'
import { refuse, type BundleSource, type Step } from './init-from-bundle-source'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

/** The root entry carrying the publisher's detached signature over `manifest.json`. */
const BUNDLE_SIGNATURE_ENTRY = 'manifest.sig'

/** A bundle that passed every check: what the writer and `--inspect` read. */
export interface OpenedBundle {
  readonly manifest: BundleManifest
  /** The project files, archive path → bytes and archive mode; never the manifest or its signature. */
  readonly files: readonly TarEntry[]
  /** `project/app.json`, parsed: the object written as `app.yaml`. */
  readonly config: unknown
  readonly verdict: Exclude<BundlePublisherVerdict, { readonly verdict: 'refused' }>
  /** sha256 of the archive bytes, as downloaded. */
  readonly sha256: string
  /** sha256 of `manifest.json`, the identity the manifest's own hashes hang from. */
  readonly manifestSha256: string
  readonly containsDemoData: boolean
}

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const RULE_TEXT: Readonly<Record<BundleEntryRefusal['rule'], string>> = {
  'unsafe-path':
    'a path that could be followed out of the project (absolute, .., ., empty, \\ or NUL)',
  'not-a-regular-file': 'not a regular file (a symlink, hard link, device or FIFO)',
  typescript:
    'TypeScript, which is a program: running one fetched from a link is a different product',
  executable: 'an executable (an execute bit, a native program header or an interpreter line)',
}

const parseJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

/** Inflate and read every header. */
const readEntries = (bytes: Uint8Array): Step<readonly TarEntry[]> => {
  const inflated = gunzipBounded(bytes, BUNDLE_MAX_STORED_BYTES)
  if (inflated._tag === 'TooLarge') {
    return refuse('The bundle inflates past the 100 MiB bound, so it was not unpacked.')
  }
  if (inflated._tag === 'NotGzip')
    return refuse('The source is not a gzip archive, so it is not a bundle.')
  const entries = readTarEntries(inflated.bytes)
  return entries === undefined
    ? refuse('The source gunzips, but not into a tar archive, so it is not a bundle.')
    : { ok: true, value: entries }
}

/** Refuse, each by path, every entry that must never land on disk. */
const entryRefusals = (entries: readonly TarEntry[]): Step<true> => {
  const refused = entries.flatMap((entry) => {
    const refusal = bundleEntryRefusal({ ...entry, head: entry.bytes.subarray(0, 4) })
    return refusal === undefined ? [] : [`  ${refusal.path}: ${RULE_TEXT[refusal.rule]}`]
  })
  const collisions = caseCollisions(entries.map((entry) => entry.path)).map(
    ([first, second]) => `  ${first} and ${second} differ only by letter case`
  )
  const lines = [...refused, ...collisions]
  return lines.length === 0
    ? { ok: true, value: true }
    : refuse(`The bundle holds entries that are never written to disk:\n${lines.join('\n')}`)
}

/** Decode the manifest, refusing the reserved embedded signature field. */
const readManifest = (
  bytes: Uint8Array
): Step<{ readonly manifest: BundleManifest; readonly raw: Readonly<Record<string, unknown>> }> => {
  const raw = parseJson(bytes)
  if (typeof raw === 'object' && raw !== null && 'signature' in raw) {
    return refuse(
      `${BUNDLE_MANIFEST_ENTRY} carries an embedded signature field; a publisher signs with ${BUNDLE_SIGNATURE_ENTRY}.`
    )
  }
  const manifest = Schema.decodeUnknownOption(bundleManifestSchema)(raw)
  return Option.isNone(manifest)
    ? refuse(`${BUNDLE_MANIFEST_ENTRY} is not a bundle manifest.`)
    : { ok: true, value: { manifest: manifest.value, raw: raw as Record<string, unknown> } }
}

/** The keys the publisher is judged against; a malformed test keyring refuses the import. */
const publisherVerdict = (
  manifestBytes: Uint8Array,
  signature: Uint8Array | undefined,
  hostname: string | undefined
): Step<OpenedBundle['verdict']> => {
  try {
    const keys = resolveBundlePublisherKeys({
      env: process.env,
      fetchedFromHost: hostname,
      privateOutboundOptIn: isSsrfRelaxed(),
    })
    const verdict = bundlePublisherVerdict({ manifestBytes, signatureEntry: signature, keys })
    return verdict.verdict === 'refused'
      ? refuse(
          `The bundle's publisher signature is refused: ${verdict.reason}. Nothing was written.`
        )
      : { ok: true, value: verdict }
  } catch (error) {
    return refuse(error instanceof Error ? error.message : String(error))
  }
}

const findingLine = (finding: ConfigFinding): string =>
  finding.path === '' ? `  ${finding.message}` : `  ${finding.message}\n    at ${finding.path}`

/** Decode `project/app.json` as `validate` does, printing findings without the rejected values. */
const decodeConfig = async (bytes: Uint8Array | undefined): Promise<Step<unknown>> => {
  const config = bytes === undefined ? undefined : parseJson(bytes)
  if (config === undefined) return refuse(`${BUNDLE_CONFIG_ENTRY} is not JSON.`)
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const result = decodeAppConfigObject(config)
  return result.valid
    ? { ok: true, value: config }
    : refuse(
        `The bundle's config is not valid, so nothing was created.\n\n${result.findings.map(findingLine).join('\n')}`
      )
}

/** The integrity, publisher and engine checks over a decoded manifest. */
const checkManifest = (
  entries: readonly TarEntry[],
  manifest: BundleManifest,
  engineVersion: string
): Step<true> => {
  const contents = new Map(
    entries
      .filter((entry) => entry.type === 'file' && entry.path !== BUNDLE_SIGNATURE_ENTRY)
      .map((entry) => [entry.path, entry.bytes] as const)
  )
  const problems = verifyBundle(manifest, contents)
  if (problems.length > 0) {
    return refuse(
      `The bundle does not match its manifest, so nothing was written:\n${problems.map((line) => `  ${line}`).join('\n')}`
    )
  }
  return compareVersions(manifest.engine.minVersion, engineVersion) > 0
    ? refuse(
        `The bundle needs Sovrium ${manifest.engine.minVersion} or newer, and this is ${engineVersion}. Update Sovrium, then open it again.`
      )
    : { ok: true, value: true }
}

/** Open a fetched or local bundle: every check, nothing written. */
export const openBundle = async (
  source: BundleSource,
  engineVersion: string
): Promise<Step<OpenedBundle>> => {
  const entries = readEntries(source.bytes)
  if (!entries.ok) return entries
  const safe = entryRefusals(entries.value)
  if (!safe.ok) return safe
  const byPath = new Map(
    entries.value.filter((entry) => entry.type === 'file').map((entry) => [entry.path, entry.bytes])
  )
  const manifestBytes = byPath.get(BUNDLE_MANIFEST_ENTRY)
  if (manifestBytes === undefined) return refuse(`The bundle holds no ${BUNDLE_MANIFEST_ENTRY}.`)
  const read = readManifest(manifestBytes)
  if (!read.ok) return read
  const checked = checkManifest(entries.value, read.value.manifest, engineVersion)
  if (!checked.ok) return checked
  const verdict = publisherVerdict(
    manifestBytes,
    byPath.get(BUNDLE_SIGNATURE_ENTRY),
    source.hostname
  )
  if (!verdict.ok) return verdict
  const config = await decodeConfig(byPath.get(BUNDLE_CONFIG_ENTRY))
  if (!config.ok) return config
  const files = entries.value.filter(
    (entry) =>
      entry.type === 'file' &&
      entry.path !== BUNDLE_MANIFEST_ENTRY &&
      entry.path !== BUNDLE_SIGNATURE_ENTRY
  )
  const declared = read.value.raw['containsDemoData']
  return {
    ok: true,
    value: {
      manifest: read.value.manifest,
      files,
      config: config.value,
      verdict: verdict.value,
      sha256: sha256Hex(source.bytes),
      manifestSha256: sha256Hex(manifestBytes),
      containsDemoData:
        typeof declared === 'boolean'
          ? declared
          : files.some((entry) => entry.path.startsWith('seed/')),
    },
  }
}
