/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath, stat } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { resolveAssetKind, type Asset } from '@/domain/models/app/assets/asset'
import {
  assetContentIssue,
  assetContentType,
  assetSizeIssue,
} from '@/domain/models/app/assets/asset-content-validation'
import { validateAssetTemplateReferences } from '@/domain/models/app/template-reference-validation'
import type { AssetStoreShape, LoadedAsset } from '@/application/ports/services/asset-store'

/**
 * Reading the private assets an app declares, once, from the project
 * directory: the boot loader behind `sovrium start` and the file checks behind
 * `sovrium validate`, which are the same function so the two cannot disagree.
 *
 * A path's spelling was already checked by the schema (relative, `/`, no
 * `..`). What only the filesystem can say is checked here: the file exists, it
 * resolves — symbolic links followed — inside the project directory and
 * outside the public directory (which serves every file it holds), it is at
 * most 10 MB, and its content is of its kind.
 */

/** The directory assets resolve against: the config's, else the content anchor, else cwd. */
export const assetProjectDir = (configPath: string | undefined): string =>
  configPath !== undefined && configPath !== ''
    ? dirname(configPath)
    : (process.env['SOVRIUM_CONTENT_DIR'] ?? process.cwd())

/**
 * A `data` asset — the sample values a template is previewed with — must
 * parse as what its extension says: JSON, or YAML.
 */
const dataAssetIssue = (path: string, kind: string, bytes: Uint8Array): string | undefined => {
  if (kind !== 'data') return undefined
  const text = new TextDecoder().decode(bytes)
  const yaml = /\.ya?ml$/i.test(path)
  try {
    if (yaml) Bun.YAML.parse(text)
    else JSON.parse(text)
    return undefined
  } catch (error) {
    const why = error instanceof Error ? error.message.split('\n', 1)[0] : String(error)
    return `asset "${path}" is not valid ${yaml ? 'YAML' : 'JSON'}: ${why}`
  }
}

/**
 * What the asset templates an app's steps read name that does not exist: a
 * partial no asset declares, a key the default language lacks. Read once the
 * files are, so `validate` and the boot give the same verdict.
 */
export const assetTemplateIssues = (app: unknown, store: AssetStoreShape): readonly string[] =>
  validateAssetTemplateReferences(app, (path) => {
    const asset = store.get(path)
    return asset === undefined || !TEXT_TEMPLATE_KINDS.has(asset.kind)
      ? undefined
      : new TextDecoder().decode(asset.bytes)
  })

const TEXT_TEMPLATE_KINDS: ReadonlySet<string> = new Set(['html', 'svg', 'partial', 'text'])

type Checked =
  | { readonly ok: true; readonly asset: LoadedAsset; readonly realpath: string }
  | { readonly ok: false; readonly issue: string }

/** Whether `path` is `dir` itself or sits beneath it. */
const isWithin = (path: string, dir: string): boolean => path === dir || path.startsWith(dir + sep)

/**
 * Why a resolved asset path sits in the wrong place: outside the project, or
 * inside the public directory that would serve it. `undefined` when it is fine.
 */
const placementIssue = (
  path: string,
  resolved: string,
  root: string,
  publicRoot: string | undefined
): string | undefined => {
  if (!resolved.startsWith(root + sep)) {
    return `asset "${path}" resolves outside the project directory (to ${resolved}); an asset must be a file inside the project`
  }
  if (publicRoot !== undefined && isWithin(resolved, publicRoot)) {
    return `asset "${path}" resolves inside the public directory (${publicRoot}), which serves every file in it; keep an asset outside the public directory`
  }
  return undefined
}

const checkOne = async (
  entry: Asset,
  root: string,
  publicRoot: string | undefined
): Promise<Checked> => {
  const fail = (issue: string): Checked => ({ ok: false, issue })
  const kind = resolveAssetKind(entry)
  if (kind === undefined) return fail(`asset "${entry.path}" has no kind`)
  const resolved = await realpath(join(root, entry.path)).catch(() => undefined)
  if (resolved === undefined) {
    return fail(`asset "${entry.path}" does not exist in the project directory (${root})`)
  }
  const misplaced = placementIssue(entry.path, resolved, root, publicRoot)
  if (misplaced !== undefined) return fail(misplaced)
  const info = await stat(resolved).catch(() => undefined)
  if (info === undefined || !info.isFile()) {
    return fail(`asset "${entry.path}" is not a file`)
  }
  const tooHeavy = assetSizeIssue(entry.path, info.size)
  if (tooHeavy !== undefined) return fail(tooHeavy)
  const bytes = new Uint8Array(await Bun.file(resolved).arrayBuffer())
  const issue =
    assetContentIssue(entry.path, kind, bytes) ?? dataAssetIssue(entry.path, kind, bytes)
  if (issue !== undefined) return fail(issue)
  return {
    ok: true,
    realpath: resolved,
    asset: { path: entry.path, kind, contentType: assetContentType(kind, entry.path), bytes },
  }
}

/** What loading an app's assets produced: the store, or every reason it could not. */
export type AssetLoadOutcome =
  | { readonly ok: true; readonly store: AssetStoreShape }
  | { readonly ok: false; readonly issues: readonly string[] }

/**
 * Read and check every declared asset. All problems are reported together, so
 * one `validate` run lists every file to fix. `publicDir` is the directory the
 * app serves (`validate` passes the `public/` beside the config); an asset
 * whose real path is inside it is refused.
 */
export const loadPrivateAssets = async (
  assets: ReadonlyArray<Asset> | undefined,
  projectDir: string,
  publicDir?: string
): Promise<AssetLoadOutcome> => {
  if (assets === undefined || assets.length === 0) {
    return { ok: true, store: { get: () => undefined, realpaths: new Set() } }
  }
  const root = await realpath(projectDir).catch(() => projectDir)
  // A public directory that does not exist serves nothing, so it holds no asset.
  const publicRoot =
    publicDir === undefined ? undefined : await realpath(publicDir).catch(() => undefined)
  const checked = await Promise.all(assets.map((entry) => checkOne(entry, root, publicRoot)))
  const issues = checked.flatMap((c) => (c.ok ? [] : [c.issue]))
  if (issues.length > 0) return { ok: false, issues }
  const loaded = checked.flatMap((c) => (c.ok ? [c] : []))
  const byPath = new Map(loaded.map((c) => [c.asset.path, c.asset] as const))
  return {
    ok: true,
    store: {
      get: (path) => byPath.get(path),
      realpaths: new Set(loaded.map((c) => c.realpath)),
    },
  }
}
