/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pinned-source half of the library operations generator: where a
 * provider's vendor specification is pinned, what its overrides may say, and
 * how one provider becomes one generated operation set.
 *
 * Imported by the generator (`scripts/build/generate-library-operations.ts`),
 * the refresh command and the drift gate
 *, so the three agree on every
 * path and every byte by construction.
 *
 * ─── THE LAYOUT ────────────────────────────────────────────────────────────
 *
 * [internal ref]<provider>/
 *     overrides.yaml   what the generator cannot read off the spec — written by hand
 *     manifest.json    what was fetched, when, its sha256 and its stated licence — written by refresh
 *     <file>           the vendor's specification, byte for byte as fetched
 *
 *   src/library/generated/<provider>.json.gz   the operation set the binary ships
 *
 * The sources are NOT shipped: nothing under `[internal ref]` is imported by
 * `src/`, the public mirror copies no part of it, and Prettier is told to leave
 * the vendor files alone (reformatting one would break its sha256). Only the
 * generated set reaches the binary.
 *
 * ─── WHY THE OVERRIDES ARE YAML, NOT TYPESCRIPT ────────────────────────────
 *
 * One `overrides.ts` per provider directory would be a one-file directory of
 * code, which the layout law refuses as a singleton, and a module nothing
 * imports by a literal specifier, which Knip reports as unused. YAML keeps the
 * comments an override needs (WHY an endpoint is excluded is the part worth
 * keeping) and is decoded here through an Effect Schema, so a misspelt key
 * fails the generator rather than being ignored.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Schema } from 'effect'
import { REPO_ROOT } from './drift/walk'
import { normaliseSpec, type GeneratedOperation, type SkippedOperation } from './library-openapi'

// =============================================================================
// Paths
// =============================================================================

export const SOURCES_DIR = join(REPO_ROOT, 'scripts', 'library', 'sources')
export const GENERATED_DIR = join(REPO_ROOT, 'src', 'library', 'generated')

export const OVERRIDES_FILE = 'overrides.yaml'
export const MANIFEST_FILE = 'manifest.json'
export const GENERATED_EXTENSION = '.json.gz'

/** The format of a generated operation set; bumped on any breaking change of its shape. */
export const OPERATION_SET_FORMAT = 1

export const sourceDir = (provider: string, root = SOURCES_DIR): string => join(root, provider)
export const generatedPath = (provider: string, root = GENERATED_DIR): string =>
  join(root, `${provider}${GENERATED_EXTENSION}`)

/** Every provider with a pinned source directory, sorted. */
export const pinnedProviders = (root = SOURCES_DIR): readonly string[] =>
  existsSync(root)
    ? readdirSync(root)
        .filter((name) => statSync(join(root, name)).isDirectory())
        .sort()
    : []

// =============================================================================
// Overrides
// =============================================================================

const Slug = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)))
const Https = Schema.String.pipe(Schema.check(Schema.isPattern(/^https:\/\/\S+$/)))

const PaginationOverride = Schema.Union([
  Schema.Struct({
    style: Schema.Literal('page'),
    pageParam: Schema.String,
    startPage: Schema.optional(Schema.Literals([0, 1])),
    itemsPath: Schema.String,
    nextPath: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    style: Schema.Literal('offset'),
    offsetParam: Schema.String,
    limitParam: Schema.String,
    limit: Schema.Finite,
    itemsPath: Schema.String,
  }),
  Schema.Struct({
    style: Schema.Literal('cursor'),
    cursorParam: Schema.String,
    cursorPath: Schema.String,
    itemsPath: Schema.String,
  }),
  Schema.Struct({ style: Schema.Literal('link'), itemsPath: Schema.optional(Schema.String) }),
  Schema.Struct({
    style: Schema.Literal('lastItem'),
    afterParam: Schema.String,
    idField: Schema.optional(Schema.String),
    hasMorePath: Schema.optional(Schema.String),
    itemsPath: Schema.String,
  }),
])

export const OverridesSchema = Schema.Struct({
  /** Must equal the directory name. */
  provider: Slug,
  /** The provider's name, as the manual prints it. Names only — never a logo. */
  title: Schema.String,
  /** The vendor's own API reference, linked from every operation instead of its prose. */
  docsUrl: Https,
  /** Every file to pin; a curated provider may pin several (one per API). */
  sources: Schema.Array(
    Schema.Struct({
      url: Https,
      file: Schema.String.pipe(Schema.check(Schema.isPattern(/^[\w.-]+\.(json|ya?ml)$/))),
    })
  ),
  /**
   * The licence the VENDOR states for the specification, where the spec itself
   * states none in `info.license` — e.g. the licence of the repository that
   * publishes it. Omitted when the vendor states nothing anywhere: the
   * generator then records "none stated" and the gate reports it.
   */
  licence: Schema.optional(Schema.Struct({ name: Schema.String, url: Https })),
  /** Replaces the spec's first server URL. */
  baseUrl: Schema.optional(Schema.String),
  /** How the connection authenticates — carried to the connection entry, not interpreted. */
  auth: Schema.optional(
    Schema.Struct({
      type: Schema.Literals(['oauth2', 'apiKey', 'basic', 'bearer', 'tokenExchange']),
      header: Schema.optional(Schema.String),
    })
  ),
  /** The vendor's published rate limit, carried as a fact for the runtime backoff. */
  rateLimit: Schema.optional(
    Schema.Struct({
      requestsPerSecond: Schema.optional(Schema.Finite),
      requestsPerMinute: Schema.optional(Schema.Finite),
    })
  ),
  groupByPath: Schema.optional(Schema.Boolean),
  includePaths: Schema.optional(Schema.Array(Schema.String)),
  includeTags: Schema.optional(Schema.Array(Schema.String)),
  exclude: Schema.optional(Schema.Array(Schema.String)),
  rename: Schema.optional(Schema.Record(Schema.String, Slug)),
  dropHeaders: Schema.optional(Schema.Array(Schema.String)),
  pagination: Schema.optional(Schema.Record(Schema.String, Schema.NullOr(PaginationOverride))),
  operationIdStrip: Schema.optional(Schema.String),
  stripPathPrefix: Schema.optional(Schema.String),
  ignoreOperationIds: Schema.optional(Schema.Boolean),
  /** Group each operation by the pinned file it came from (one file per API). */
  groupBySourceFile: Schema.optional(Schema.Boolean),
})

export type ProviderOverrides = Schema.Schema.Type<typeof OverridesSchema>

export const readOverrides = (provider: string, root = SOURCES_DIR): ProviderOverrides => {
  const path = join(sourceDir(provider, root), OVERRIDES_FILE)
  const raw = Bun.YAML.parse(readFileSync(path, 'utf8'))
  const decoded = Schema.decodeUnknownResult(OverridesSchema)(raw)
  if (decoded._tag === 'Failure') {
    throw new Error(`${provider}/${OVERRIDES_FILE}: ${String(decoded.failure)}`)
  }
  if (decoded.success.provider !== provider) {
    throw new Error(
      `${provider}/${OVERRIDES_FILE}: provider \`${decoded.success.provider}\` does not match its directory`
    )
  }
  return decoded.success
}

// =============================================================================
// Manifest
// =============================================================================

export interface StatedLicence {
  /** Where the vendor states it: `spec3.json info.license`, or `overrides.yaml`. */
  readonly where: string
  readonly name: string
  readonly url?: string
}

export interface SourceManifest {
  readonly provider: string
  readonly fetchedOn: string
  readonly files: readonly {
    readonly file: string
    readonly url: string
    readonly sha256: string
    readonly bytes: number
  }[]
  /** Empty when the vendor states no licence anywhere — the open founder question. */
  readonly licence: readonly StatedLicence[]
}

export const readManifest = (provider: string, root = SOURCES_DIR): SourceManifest =>
  JSON.parse(readFileSync(join(sourceDir(provider, root), MANIFEST_FILE), 'utf8')) as SourceManifest

export const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256')
    .update(typeof bytes === 'string' ? bytes : Buffer.from(bytes))
    .digest('hex')

/** Parse a pinned spec file by its extension. */
export const parseSpec = (file: string, text: string): Readonly<Record<string, unknown>> =>
  (file.endsWith('.json') ? JSON.parse(text) : Bun.YAML.parse(text)) as Readonly<
    Record<string, unknown>
  >

/** The licences a spec states in `info.license`, plus the one the overrides record. */
export const statedLicences = (
  specs: readonly { readonly file: string; readonly doc: Readonly<Record<string, unknown>> }[],
  overrides: ProviderOverrides
): readonly StatedLicence[] => {
  const fromSpecs = specs.flatMap(({ file, doc }) => {
    const info = doc['info'] as { readonly license?: { name?: unknown; url?: unknown } } | undefined
    const name = info?.license?.name
    if (typeof name !== 'string' || name.trim() === '') return []
    const url = info?.license?.url
    return [{ where: `${file} info.license`, name, ...(typeof url === 'string' ? { url } : {}) }]
  })
  const declared =
    overrides.licence === undefined
      ? []
      : [{ where: OVERRIDES_FILE, name: overrides.licence.name, url: overrides.licence.url }]
  const unique = new Map(
    [...fromSpecs, ...declared].map((licence) => [`${licence.where}|${licence.name}`, licence])
  )
  return [...unique.values()]
}

// =============================================================================
// The operation set
// =============================================================================

/**
 * One provider's generated operations — the file the binary ships. Every
 * operation is a `ConnectionOperation` exactly as an operator would write it;
 * everything else is provenance and grouping, read by the manual and by
 * `library add`, never installed.
 */
export interface OperationSet {
  readonly format: number
  readonly provider: string
  readonly title: string
  readonly docsUrl: string
  readonly baseUrl?: string
  readonly auth?: ProviderOverrides['auth']
  readonly rateLimit?: ProviderOverrides['rateLimit']
  readonly source: {
    readonly fetchedOn: string
    readonly licence: readonly StatedLicence[]
    readonly files: readonly { readonly url: string; readonly sha256: string }[]
  }
  /** Group → operation names, both sorted. */
  readonly groups: Readonly<Record<string, readonly string[]>>
  /** Sorted by name. */
  readonly operations: readonly GeneratedOperation[]
}

export interface GeneratedProvider {
  readonly set: OperationSet
  readonly skipped: readonly SkippedOperation[]
  /** The pinned files whose bytes no longer match the manifest. */
  readonly shaMismatches: readonly string[]
}

/**
 * Generate one provider from its pinned source. Pure apart from reading the
 * pinned files, so the generator and the drift gate produce the same object.
 */
export const generateProvider = (provider: string, root = SOURCES_DIR): GeneratedProvider => {
  const overrides = readOverrides(provider, root)
  const manifest = readManifest(provider, root)
  const specs = overrides.sources.map(({ file }) => {
    const bytes = readFileSync(join(sourceDir(provider, root), file))
    return { file, bytes, doc: parseSpec(file, bytes.toString('utf8')) }
  })
  const shaMismatches = specs
    .filter(
      ({ file, bytes }) => manifest.files.find((f) => f.file === file)?.sha256 !== sha256(bytes)
    )
    .map(({ file }) => file)
  const options = {
    ...(overrides.rename === undefined ? {} : { rename: overrides.rename }),
    ...(overrides.exclude === undefined ? {} : { exclude: overrides.exclude }),
    ...(overrides.includePaths === undefined ? {} : { includePaths: overrides.includePaths }),
    ...(overrides.includeTags === undefined ? {} : { includeTags: overrides.includeTags }),
    ...(overrides.dropHeaders === undefined ? {} : { dropHeaders: overrides.dropHeaders }),
    ...(overrides.groupByPath === undefined ? {} : { groupByPath: overrides.groupByPath }),
    ...(overrides.pagination === undefined ? {} : { pagination: overrides.pagination }),
    ...(overrides.operationIdStrip === undefined
      ? {}
      : { operationIdStrip: overrides.operationIdStrip }),
    ...(overrides.stripPathPrefix === undefined
      ? {}
      : { stripPathPrefix: overrides.stripPathPrefix }),
    ...(overrides.ignoreOperationIds === undefined
      ? {}
      : { ignoreOperationIds: overrides.ignoreOperationIds }),
  }
  const results = specs.map(({ file, doc }) => {
    try {
      return normaliseSpec(doc, options)
    } catch (error) {
      throw new Error(
        `${provider}/${file}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  })
  const normalised = results.flatMap((result, index) =>
    overrides.groupBySourceFile === true
      ? result.operations.map((item) => ({
          ...item,
          groups: [(specs[index]?.file ?? '').replace(/\.(json|ya?ml)$/, '')],
        }))
      : result.operations
  )
  const names = normalised.map(({ operation }) => operation.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate !== undefined) {
    throw new Error(
      `${provider}: operation \`${duplicate}\` is generated by two pinned files — add a rename override`
    )
  }
  const groups = normalised
    .flatMap(({ operation, groups: of }) => of.map((group) => [group, operation.name] as const))
    .reduce<Readonly<Record<string, readonly string[]>>>(
      (acc, [group, name]) => ({ ...acc, [group]: [...(acc[group] ?? []), name] }),
      {}
    )
  const sortedGroups = Object.fromEntries(
    Object.keys(groups)
      .sort()
      .map((group) => [group, [...(groups[group] ?? [])].sort()])
  )
  const baseUrl = overrides.baseUrl ?? results.find((result) => result.serverUrl)?.serverUrl
  const set: OperationSet = {
    format: OPERATION_SET_FORMAT,
    provider,
    title: overrides.title,
    docsUrl: overrides.docsUrl,
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(overrides.auth === undefined ? {} : { auth: overrides.auth }),
    ...(overrides.rateLimit === undefined ? {} : { rateLimit: overrides.rateLimit }),
    source: {
      fetchedOn: manifest.fetchedOn,
      licence: manifest.licence,
      files: manifest.files.map(({ url, sha256: digest }) => ({ url, sha256: digest })),
    },
    groups: sortedGroups,
    operations: [...normalised.map(({ operation }) => operation)].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    ),
  }
  return { set, skipped: results.flatMap((result) => result.skipped), shaMismatches }
}

// =============================================================================
// Serialisation
// =============================================================================

/** The canonical JSON text of a set — what the drift gate compares byte for byte. */
export const serialiseSet = (set: OperationSet): string => `${JSON.stringify(set)}\n`

/**
 * Gzip with a fixed header. The OS byte of a gzip header records the platform
 * that wrote it, so it is pinned to 255 ("unknown") here; the gate nonetheless
 * compares the DECOMPRESSED text, because two zlib builds may legitimately emit
 * different deflate streams for the same input.
 */
export const compressSet = (text: string): Uint8Array => {
  const bytes = Bun.gzipSync(new TextEncoder().encode(text), { level: 9 })
  const pinned = new Uint8Array(bytes)
  pinned.set([255], 9)
  return pinned
}

export const decompressSet = (bytes: Uint8Array): string =>
  new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(bytes)))

// =============================================================================
// Size budget — read by `Library Operations` and `Performance Budget Drift`
// =============================================================================

/**
 * Ceilings on what the operation sets add to the binary, compressed. Every set
 * is embedded in full into every compiled binary whether or not an operator
 * ever installs one of its operations, so the total is binary weight every
 * self-hoster pays. One provider past its ceiling is almost always a curated
 * subset that stopped being curated.
 */
export const OPERATION_SET_BUDGET_BYTES = 300_000
export const OPERATION_SETS_TOTAL_BUDGET_BYTES = 1_500_000

/** The committed operation sets and their compressed sizes, sorted by provider. */
export const operationSetSizes = (
  root = GENERATED_DIR
): readonly { readonly provider: string; readonly bytes: number }[] =>
  existsSync(root)
    ? readdirSync(root)
        .filter((name) => name.endsWith(GENERATED_EXTENSION))
        .sort()
        .map((name) => ({
          provider: name.slice(0, -GENERATED_EXTENSION.length),
          bytes: statSync(join(root, name)).size,
        }))
    : []

/** Human-readable findings for any set, or the total, over its ceiling. */
export const operationSetBudgetFindings = (
  sizes: readonly { readonly provider: string; readonly bytes: number }[]
): readonly string[] => {
  const total = sizes.reduce((sum, { bytes }) => sum + bytes, 0)
  return [
    ...sizes
      .filter(({ bytes }) => bytes > OPERATION_SET_BUDGET_BYTES)
      .map(
        ({ provider, bytes }) =>
          `${provider}: ${bytes} bytes compressed, over the ${OPERATION_SET_BUDGET_BYTES}-byte per-provider ceiling`
      ),
    ...(total > OPERATION_SETS_TOTAL_BUDGET_BYTES
      ? [
          `all sets: ${total} bytes compressed, over the ${OPERATION_SETS_TOTAL_BUDGET_BYTES}-byte total ceiling`,
        ]
      : []),
  ]
}
