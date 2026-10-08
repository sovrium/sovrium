/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join } from 'node:path'
import { Data, Effect, Schema } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import {
  BUNDLE_CONFIG_ENTRY,
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  BUNDLE_MANIFEST_ENTRY,
  bundleManifestSchema,
  type BundleManifest,
} from './bundle-manifest'
import { collectConfigEntries } from './config-tree-entries'
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
 * The URL-safe form of an app name: lowercase, a scope's `@` dropped, every
 * other run of characters outside `[a-z0-9]` written `-` (so `@atelier/crm`
 * becomes `atelier-crm`), `app` when nothing is left.
 */
const bundleSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app'

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

/**
 * The archive entries, config first: `project/app.json` from the validated
 * document, then `public/` and `seed/`. The config graph is read for its
 * refusal only — its files travel inlined in the document, never as sources.
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
    const publicEntries = yield* collectTree(request.publicDirectory, 'public/')
    const seedEntries = yield* collectTree(join(dirname(request.configPath), 'seed'), 'seed/')
    return [config, ...publicEntries, ...seedEntries]
  })

/**
 * `sovrium bundle`: one gzipped tar holding the validated config resolved into
 * `project/app.json`, the static files under `public/` and the seed files under
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
