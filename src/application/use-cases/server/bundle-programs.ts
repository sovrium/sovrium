/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Data, Effect, Schema } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import { requiredEnvNamesOf } from '@/application/use-cases/env/validate-required-env-vars'
import { deriveAppSlug } from '@/domain/models/app/name-service'
import { isMarkdownSourceFile } from '@/domain/models/app/pages/markdown-source-file-service'
import { SEED_IMPORT_LAYER } from '@/domain/models/seed/seed-jsonl'
import {
  BUNDLE_CONFIG_ENTRY,
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  BUNDLE_MANIFEST_ENTRY,
  bundleManifestSchema,
  type BundleManifest,
} from './bundle-manifest'
import { collectStarterEntries } from './bundle-starter-entries'
import { collectConfigEntries, toEntryPath } from './config-tree-entries'
import type { BackupIoError } from '@/application/ports/services/backup-workspace'

/** Everything `sovrium bundle` was asked, with the config already validated. */
export interface BundleRequest {
  /** The config file, absolute. */
  readonly configPath: string
  /**
   * The config document as `sovrium validate` read and accepted it: every
   * `$ref` inlined, a TypeScript config evaluated, `$env` references kept.
   */
  readonly document: Readonly<Record<string, unknown>>
  /** `--output`, absolute; `undefined` names a dated file in `workingDirectory`. */
  readonly outputPath: string | undefined
  readonly workingDirectory: string
  /** The static-file directory to carry as `public/`, absolute; `undefined` carries none. */
  readonly publicDirectory: string | undefined
  readonly engineVersion: string
  readonly now: Readonly<Date>
}

/** What was written. */
export interface BundleSummary {
  readonly archivePath: string
  readonly archiveBytes: number
  readonly manifest: BundleManifest
}

/**
 * A condition that stops the bundle before the archive exists. `reason` is the
 * clause the CLI completes with "— nothing was written."
 */
export class BundleRefusal extends Data.TaggedError('BundleRefusal')<{
  readonly reason: string
  readonly guidance: string
}> {}

/**
 * The URL-safe form of an app name for the archive's file name — the address
 * `sovrium deploy` derives ({@link deriveAppSlug}), or `app` when nothing is left.
 */
const bundleSlug = (name: string): string => deriveAppSlug(name) || 'app'

const twoDigits = (value: number): string => String(value).padStart(2, '0')

/** `sovrium-bundle-<slug>-<YYYYMMDD>-<HHMMSS>.tar.gz`, on the operator's clock. */
const defaultBundleName = (slug: string, at: Readonly<Date>): string => {
  const day = `${at.getFullYear()}${twoDigits(at.getMonth() + 1)}${twoDigits(at.getDate())}`
  const time = `${twoDigits(at.getHours())}${twoDigits(at.getMinutes())}${twoDigits(at.getSeconds())}`
  return `sovrium-bundle-${slug}-${day}-${time}.tar.gz`
}

/** Every file below `directory`, as `<prefix><relative>` entries; none when it is missing. */
const collectTree = (directory: string | undefined, prefix: string) =>
  Effect.gen(function* () {
    if (directory === undefined) return []
    const workspace = yield* BackupWorkspace
    const files = yield* workspace.listFiles(directory)
    return yield* Effect.forEach(files, (file) =>
      Effect.map(workspace.readFileIfExists(join(directory, file)), (bytes) => ({
        path: `${prefix}${file}`,
        bytes: bytes ?? new Uint8Array(),
      }))
    )
  })

/**
 * The manifest, decoded through its own schema before it is written: an entry
 * path the format refuses (a file name a reader could not unpack safely) stops
 * the bundle here rather than producing an archive no host would accept.
 */
const checkedManifest = (manifest: BundleManifest) =>
  Schema.decodeEffect(bundleManifestSchema)(manifest).pipe(
    Effect.mapError(
      (issue) =>
        new BundleRefusal({
          reason: `The bundle manifest would not be valid (${issue.message})`,
          guidance:
            'Rename the file it names so its path holds no backslash, empty, . or .. segment, then run the command again.',
        })
    )
  )

/** The `path` of every entry the validated document declares under `assets`. */
const declaredAssetPaths = (document: Readonly<Record<string, unknown>>): readonly string[] => {
  const { assets } = document
  if (!Array.isArray(assets)) return []
  return assets.flatMap((asset: unknown) =>
    typeof asset === 'object' && asset !== null && typeof Reflect.get(asset, 'path') === 'string'
      ? [String(Reflect.get(asset, 'path'))]
      : []
  )
}

/**
 * The private assets as `project/<path>` entries, read from the project the
 * validation already checked them in (symbolic links followed, inside the
 * project, outside `public/`). Unpacked, they sit beside `project/app.json`,
 * where the asset loader resolves them.
 */
const collectAssetEntries = (request: BundleRequest) =>
  Effect.gen(function* () {
    const paths = declaredAssetPaths(request.document)
    // Case-blind: unpacked on a case-insensitive filesystem, `App.json` would
    // land on the config entry just the same.
    const clash = paths.find(
      (path) => `project/${path}`.toLowerCase() === BUNDLE_CONFIG_ENTRY.toLowerCase()
    )
    if (clash !== undefined) {
      return yield* new BundleRefusal({
        reason: `The asset "${clash}" would be written over the config entry ${BUNDLE_CONFIG_ENTRY}`,
        guidance: `Rename the asset file and its path under assets, then run the command again.`,
      })
    }
    const workspace = yield* BackupWorkspace
    const projectDir = dirname(request.configPath)
    return yield* Effect.forEach(paths, (path) =>
      Effect.flatMap(workspace.readFileIfExists(join(projectDir, path)), (bytes) =>
        // Validation found the file a moment ago; one that vanished since is
        // refused rather than carried as an empty file a host would trust.
        bytes === undefined
          ? Effect.fail(
              new BundleRefusal({
                reason: `The asset "${path}" disappeared from the project directory while the bundle was written`,
                guidance: 'Restore the file, then run the command again.',
              })
            )
          : Effect.succeed({ path: `project/${path}`, bytes })
      )
    )
  })

/** Where a page reads markdown: a `contentDir`, a `markdown.file` or a `.md` `source.file`. */
type PageSource =
  | {
      readonly page: string
      readonly kind: 'directory'
      readonly directory: string
      readonly include: string | undefined
    }
  | { readonly page: string; readonly kind: 'file'; readonly file: string }

/** One file a page reads: the page, the path as declared, and its `project/` entry. */
interface PageFile {
  readonly page: string
  readonly declared: string
  readonly entry: string
}

const stringAt = (value: unknown, key: string): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const found: unknown = Reflect.get(value, key)
  return typeof found === 'string' ? found : undefined
}

/** The `contentDir`, `markdown.file` and `.md` `source.file` of one page of the document. */
const sourcesOfPage = (page: unknown): readonly PageSource[] => {
  if (typeof page !== 'object' || page === null) return []
  const name = stringAt(page, 'name') ?? stringAt(page, 'path') ?? 'unnamed'
  const contentDir: unknown = Reflect.get(page, 'contentDir')
  const directory = stringAt(contentDir, 'directory')
  const file = stringAt(Reflect.get(page, 'markdown'), 'file')
  const sourceFile = stringAt(Reflect.get(page, 'source'), 'file')
  return [
    ...(directory === undefined
      ? []
      : [
          {
            page: name,
            kind: 'directory' as const,
            directory,
            include: stringAt(contentDir, 'include'),
          },
        ]),
    ...(file === undefined ? [] : [{ page: name, kind: 'file' as const, file }]),
    ...(sourceFile === undefined || !isMarkdownSourceFile(sourceFile)
      ? []
      : [{ page: name, kind: 'file' as const, file: sourceFile }]),
  ]
}

/** `absolute` measured from `directory`, or `undefined` when it is not below it. */
const below = (directory: string, absolute: string): string | undefined => {
  const rel = relative(directory, absolute)
  const outside = rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
  return outside ? undefined : toEntryPath(rel)
}

/** A declared path measured from the project, or `undefined` when absolute or outside it. */
const insideProject = (projectDir: string, path: string): string | undefined =>
  isAbsolute(path) ? undefined : below(projectDir, resolve(projectDir, path))

const outsideRefusal = (page: string, declared: string, projectDir: string) =>
  new BundleRefusal({
    reason: isAbsolute(declared)
      ? `The page "${page}" reads ${declared} by an absolute path, so a bundle would not put it back in the same place`
      : `The page "${page}" reads ${declared}, which is outside the config directory ${projectDir}, so a bundle would carry a file from beyond the project`,
    guidance: `Move it under ${projectDir} and point the page at its path from there, then run 'sovrium bundle' again.`,
  })

/** The file a page source names, or every file its directory's include matches. */
const filesOfSource = (source: PageSource, projectDir: string) =>
  Effect.gen(function* () {
    if (source.kind === 'file') return [{ page: source.page, declared: source.file }]
    if (insideProject(projectDir, source.directory) === undefined) {
      return yield* outsideRefusal(source.page, source.directory, projectDir)
    }
    const workspace = yield* BackupWorkspace
    const files = yield* workspace.listContentDirFiles(
      join(projectDir, source.directory),
      source.include
    )
    return files.map((file) => ({ page: source.page, declared: join(source.directory, file) }))
  })

/**
 * Every file a page reads, each checked: inside the project (an `include`
 * holding `../` is caught here) and not on the config entry. Deduplicated,
 * and without the paths `taken` already holds (a declared asset).
 */
const pageFilesOf = (request: BundleRequest, taken: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const projectDir = dirname(request.configPath)
    const sources = Array.isArray(request.document['pages'])
      ? request.document['pages'].flatMap(sourcesOfPage)
      : []
    const listed = (yield* Effect.forEach(sources, (source) =>
      filesOfSource(source, projectDir)
    )).flat()
    const files: readonly PageFile[] = yield* Effect.forEach(listed, ({ page, declared }) => {
      const rel = insideProject(projectDir, declared)
      if (rel === undefined) return Effect.fail(outsideRefusal(page, declared, projectDir))
      if (`project/${rel}`.toLowerCase() === BUNDLE_CONFIG_ENTRY.toLowerCase()) {
        return Effect.fail(
          new BundleRefusal({
            reason: `The page "${page}" reads "${declared}", which would be written over the config entry ${BUNDLE_CONFIG_ENTRY}`,
            guidance: 'Rename the file and the path the page reads, then run the command again.',
          })
        )
      }
      return Effect.succeed({ page, declared, entry: `project/${rel}` })
    })
    return files.filter(
      (file, index) =>
        !taken.has(file.entry) && files.findIndex((other) => other.entry === file.entry) === index
    )
  })

/**
 * The markdown the pages read from disk — every file a `contentDir` matches,
 * every `markdown.file` and every `.md` `source.file` — as `project/<path>`
 * entries, at their path from the config's directory, where `sovrium start`
 * reads them once unpacked. A file that is not there is carried as nothing, as
 * the server renders it; one whose symbolic links resolve outside the project
 * is refused, as an asset is.
 */
const collectPageFileEntries = (request: BundleRequest, taken: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const projectDir = dirname(request.configPath)
    const realProject = (yield* workspace.realPath(projectDir)) ?? projectDir
    const files = yield* pageFilesOf(request, taken)
    const entries = yield* Effect.forEach(files, (file) =>
      Effect.gen(function* () {
        const absolute = join(projectDir, file.entry.slice('project/'.length))
        const real = yield* workspace.realPath(absolute)
        if (real === undefined) return []
        if (below(realProject, real) === undefined) {
          return yield* new BundleRefusal({
            reason: `The page "${file.page}" reads ${file.declared}, which resolves outside the config directory (to ${real}), so a bundle would carry a file from beyond the project`,
            guidance: `Replace the link with the file itself, under ${projectDir}, then run 'sovrium bundle' again.`,
          })
        }
        const bytes = yield* workspace.readFileIfExists(real)
        return bytes === undefined ? [] : [{ path: file.entry, bytes }]
      })
    )
    return entries.flat()
  })

/**
 * The archive entries, config first: `project/app.json` from the validated
 * document, then the declared assets, the files the pages read and the
 * starter files beside it, then `public/` and `seed/`.
 * The config graph is read for its refusal only — its files travel inlined in
 * the document, never as sources.
 */
const collectBundleEntries = (request: BundleRequest) =>
  Effect.gen(function* () {
    yield* collectConfigEntries(
      request.configPath,
      'project/',
      (outside, configDir) =>
        new BundleRefusal({
          reason: `The $ref target ${outside} is outside the config directory ${configDir}, so a bundle would carry a file from beyond the project`,
          guidance: `Move it under ${configDir} and point the $ref at its new path, then run 'sovrium bundle' again.`,
        })
    )
    const config = {
      path: BUNDLE_CONFIG_ENTRY,
      bytes: new TextEncoder().encode(`${JSON.stringify(request.document, undefined, 2)}\n`),
    }
    const assetEntries = yield* collectAssetEntries(request)
    const pageEntries = yield* collectPageFileEntries(
      request,
      new Set(assetEntries.map((entry) => entry.path))
    )
    const publicEntries = yield* collectTree(request.publicDirectory, 'public/')
    // `seed/import/` holds the records a migration carried in — personal data,
    // gitignored for that reason — so it never travels in a bundle.
    const seedEntries = (yield* collectTree(
      join(dirname(request.configPath), 'seed'),
      'seed/'
    )).filter((entry) => !entry.path.startsWith(`seed/${SEED_IMPORT_LAYER}/`))
    const starter = yield* collectStarterEntries(request.configPath, [
      ...assetEntries,
      ...pageEntries,
    ])
    return [config, ...assetEntries, ...pageEntries, ...starter, ...publicEntries, ...seedEntries]
  })

/**
 * `sovrium bundle`: one gzipped tar holding the validated config resolved into
 * `project/app.json`, the private assets it declares and the markdown its pages
 * read beside it, the static files under `public/` and the seed files under
 * `seed/`, with a manifest of every entry's size and sha256.
 *
 * Every refusal happens before the archive exists, and the archive is written
 * atomically, so a refused bundle never leaves a file a host might deploy.
 */
export const createBundle = (
  request: BundleRequest
): Effect.Effect<BundleSummary, BundleRefusal | BackupIoError, BackupWorkspace> =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const entries = yield* collectBundleEntries(request)
    const listed = yield* Effect.forEach(entries, (entry) =>
      Effect.map(workspace.sha256(entry.bytes), (sha256) => ({
        path: entry.path,
        sha256,
        size: entry.bytes.byteLength,
      }))
    )
    const name = String(request.document['name'] ?? '')
    const slug = bundleSlug(name)
    const manifest = yield* checkedManifest({
      format: BUNDLE_FORMAT,
      formatVersion: BUNDLE_FORMAT_VERSION,
      engine: { minVersion: request.engineVersion },
      app: { name, slug },
      configHash: listed[0]?.sha256 ?? '',
      createdAt: request.now.toISOString(),
      entries: listed,
      requiredEnv: requiredEnvNamesOf(request.document),
      ...(entries.some((entry) => entry.path.startsWith('seed/'))
        ? { containsDemoData: true }
        : {}),
    })
    const archivePath =
      request.outputPath ?? join(request.workingDirectory, defaultBundleName(slug, request.now))
    const archiveBytes = yield* workspace.writeArchive(
      archivePath,
      new Map([
        [
          BUNDLE_MANIFEST_ENTRY,
          new TextEncoder().encode(`${JSON.stringify(manifest, undefined, 2)}\n`),
        ],
        ...entries.map((entry): readonly [string, Uint8Array] => [entry.path, entry.bytes]),
      ])
    )
    return { archivePath, archiveBytes, manifest }
  }).pipe(Effect.withSpan('server.create-bundle'))
