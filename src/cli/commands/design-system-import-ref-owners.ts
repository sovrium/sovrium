/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files a YAML or JSON config is assembled from, for `sovrium
 * design-system import --write` to write each value into the one that holds it.
 *
 * Read as the resolver reads them (`ref-resolver.ts`): a `{ $ref }` node whose
 * value is a path names a file, resolved against the folder of the file that
 * writes it. Each file is kept as its text, its format and its RAW tree, the
 * includes left as written, so a write can render the file again with every
 * include in place. The ownership rules themselves are the pure ones of
 * `ref-write-back.ts`; this module adds the disk: which files, how a file is
 * named in a report, and whether a file lies inside the config's folder.
 */

import { realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { type Pointer } from '@/domain/kernel/config-parsing/ref-tree-compare'
import {
  includeOf,
  jsonPointerOf,
  ownerOf,
  type RefGraph,
} from '@/domain/kernel/config-parsing/ref-write-back'

/** One file of the config: its text, its format and its raw tree. */
export interface RefFile {
  readonly path: string
  readonly text: string
  readonly format: 'yaml' | 'json'
  readonly tree: unknown
  /** How the first `$ref` naming it spells it; the config's own name for the config. */
  readonly spelledAs: string
}

/** A config and every file it includes. */
export interface ConfigFiles {
  readonly configPath: string
  readonly graph: RefGraph
  readonly files: ReadonlyMap<string, RefFile>
}

const parseTree = (text: string, format: 'yaml' | 'json'): unknown =>
  format === 'json' ? (JSON.parse(text) as unknown) : Bun.YAML.parse(text)

/** The path a `$ref` written in `from` names: resolved against `from`'s folder. */
const targetOf = (from: string, ref: string): string => resolve(dirname(from), ref)

/** Every `$ref` a raw tree writes, at any depth. */
const refsOf = (node: unknown): readonly string[] => {
  const ref = includeOf(node)
  if (ref !== undefined) return [ref]
  if (Array.isArray(node)) return node.flatMap(refsOf)
  if (typeof node !== 'object' || node === null) return []
  return Object.values(node).flatMap(refsOf)
}

/** Read one file of the graph and, after it, every file it includes. */
const readInto = async (
  files: ReadonlyMap<string, RefFile>,
  path: string,
  spelledAs: string
): Promise<ReadonlyMap<string, RefFile>> => {
  if (files.has(path)) return files
  const format = detectFormat(path)
  if (format !== 'yaml' && format !== 'json') return files
  const text = await Bun.file(path).text()
  const tree = parseTree(text, format)
  const withFile = new Map(files).set(path, { path, text, format, tree, spelledAs })
  return refsOf(tree).reduce<Promise<ReadonlyMap<string, RefFile>>>(
    async (previous, ref) => readInto(await previous, targetOf(path, ref), ref),
    Promise.resolve(withFile)
  )
}

/**
 * Read a YAML or JSON config and every file it includes. The config has been
 * loaded and judged already, so every file named here exists and parses.
 *
 * @param configPath - the config, as an absolute path.
 */
export const readConfigFiles = async (configPath: string): Promise<ConfigFiles> => {
  const root = resolve(configPath)
  const files = await readInto(new Map(), root, basename(root))
  return {
    configPath: root,
    files,
    graph: {
      root,
      target: targetOf,
      trees: new Map([...files].map(([path, file]) => [path, file.tree] as const)),
    },
  }
}

/** Whether the config includes at least one other file, so a write goes through `$ref`. */
export const isAssembled = (config: ConfigFiles): boolean => config.files.size > 1

/** A file as a report names it: relative to the config's folder, `/`-separated. */
export const displayFile = (configPath: string, path: string): string =>
  relative(dirname(resolve(configPath)), path)
    .split(sep)
    .join('/')

/** Where a resolved position is written, as a report names it. */
export interface FilePosition {
  readonly file: string
  readonly pathInFile: string
}

/**
 * The file a resolved position belongs to and its JSON Pointer in that file.
 *
 * @param config - the config and its files.
 * @param position - the position in the resolved config.
 */
export const positionOf = (config: ConfigFiles, position: Pointer): FilePosition => {
  const owner = ownerOf(config.graph, position)
  return {
    file: displayFile(config.configPath, owner.file),
    pathInFile: jsonPointerOf(owner.pointer),
  }
}

/** The file a whole node is: the partial an include names, else the file writing it. */
export const fileOf = (config: ConfigFiles, position: Pointer): string =>
  displayFile(config.configPath, ownerOf(config.graph, position, { whole: true }).file)

/** The real path of a file, or of the nearest folder above it that exists. */
const realPathOf = async (path: string): Promise<string> => {
  try {
    return await realpath(path)
  } catch {
    // Not there yet: judged by the folder it would be written in.
    const parent = dirname(path)
    return parent === path ? path : join(await realPathOf(parent), basename(path))
  }
}

/**
 * Whether a file lies outside the folder holding the config, symbolic links
 * followed. Reading such a file is allowed; writing to it is refused.
 *
 * @param configPath - the config.
 * @param path - the file to write.
 */
export const isOutsideFolder = async (configPath: string, path: string): Promise<boolean> => {
  const folder = await realPathOf(dirname(resolve(configPath)))
  const target = await realPathOf(path)
  const from = relative(folder, target)
  return from === '' || from.startsWith('..') || isAbsolute(from)
}
