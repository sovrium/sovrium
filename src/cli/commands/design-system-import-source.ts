/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import` — reading the source a design tool exported.
 *
 * The source is a LOCAL path, a file or a folder, and nothing else: a URL is
 * refused before anything is read, because the import calls no network and a
 * remote file changing between two runs would break the idempotence a write
 * promises. A folder is read for its `.json` and `.css` files only, in sorted
 * order so two runs read the same bytes in the same order; a resolver file
 * also brings the documents its `$ref`s name, and nothing else beside it.
 *
 * ─── THE READ STAYS INSIDE THE PATH IT WAS GIVEN ───────────────────────────
 *
 * The path named on the command line is the operator's and is followed. Below
 * it, a symbolic link is never followed — Bun's recursive `readdir` descends
 * through a linked directory, so the walk is our own — and a resolver `$ref`
 * that climbs out of its folder is not read. A file past `MAX_FILE_BYTES` and
 * a folder past `MAX_FILES` token files or `MAX_ENTRIES` entries are refused
 * rather than truncated: a token export is never that large, and a silently
 * shortened read would be a design with a hole in it.
 */

import { lstat, readdir, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseJson } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  isDtcgResolver,
  resolverFileRefs,
} from '@/domain/models/app/design/adapters/import/dtcg-import-service'
import { refuse } from './app-prelude'
import type { ImportSource } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'

/** Token files past this many in a folder are refused: a token export is never that large. */
const MAX_FILES = 2000

/** Entries walked past this many are refused: the path is a whole tree, not an export. */
const MAX_ENTRIES = 20_000

/** A token file past this size is refused: real exports weigh a few hundred KB. */
const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Folders never descended into. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git'])

const TOKEN_FILE = /\.(?:json|css)$/i

/** `scheme://…` — what a URL looks like, as opposed to a local path. */
const URL_SOURCE = /^[a-z][a-z0-9+.-]*:\/\//i

/** A source as read: the files, and how many components sit beside them. */
export interface ReadSource {
  readonly path: string
  readonly source: ImportSource
  readonly components: number
  readonly isFolder: boolean
}

const toPosix = (path: string): string => path.split(sep).join('/')

/** Whether a filesystem error says the thing is simply not there. */
const isAbsent = (error: unknown): boolean => {
  const code = (error as { readonly code?: unknown } | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/** `undefined` for a path that is not there; any other failure still throws. */
const unlessAbsent = (error: unknown): undefined => {
  if (isAbsent(error)) return undefined
  throw error
}

const refuseTooLarge = (root: string, what: string): never =>
  refuse(
    `Error: "${root}" holds ${what}, which is not a token export.\n\n` +
      '  Pass the folder or file the design tool exported, not a parent of it.'
  )

/** What a walk has found so far. */
interface Walked {
  readonly files: readonly string[]
  readonly folders: readonly string[]
  readonly entries: number
}

/** One folder's entries added to a walk: token files kept, sub-folders queued, links skipped. */
const walkFolder = async (root: string, folder: string, walked: Walked): Promise<Walked> => {
  const entries = await readdir(join(root, folder), { withFileTypes: true })
  const pathOf = (name: string): string => (folder === '' ? name : `${folder}/${name}`)
  const next: Walked = {
    files: [
      ...walked.files,
      ...entries
        .filter((entry) => entry.isFile() && TOKEN_FILE.test(entry.name))
        .map((entry) => pathOf(entry.name)),
    ],
    folders: [
      ...walked.folders,
      ...entries
        .filter((entry) => entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name))
        .map((entry) => pathOf(entry.name)),
    ],
    entries: walked.entries + entries.length,
  }
  if (next.entries > MAX_ENTRIES) return refuseTooLarge(root, `more than ${MAX_ENTRIES} entries`)
  if (next.files.length > MAX_FILES) {
    return refuseTooLarge(root, `more than ${MAX_FILES} .json and .css files`)
  }
  return next
}

/**
 * Every token file under `root`, relative to it with `/` separators, sorted.
 * A symbolic link is skipped, file or folder (`Dirent` reports a link as a
 * link, never as what it points at); a skipped folder is never entered.
 */
const listTokenFiles = async (root: string): Promise<readonly string[]> => {
  const step = async (walked: Walked): Promise<Walked> => {
    const [folder, ...rest] = walked.folders
    if (folder === undefined) return walked
    return step(await walkFolder(root, folder, { ...walked, folders: rest }))
  }
  const walked = await step({ files: [], folders: [''], entries: 0 })
  return walked.files.toSorted()
}

/**
 * One file's text, refusing a non-file and an oversized file. A link found
 * below the source is refused too; the file named on the command line is the
 * operator's own choice and is followed (`follow`).
 */
const readTokenFile = async (root: string, path: string, follow = false): Promise<string> => {
  const absolute = join(root, path)
  const info = follow ? await stat(absolute) : await lstat(absolute)
  if (!info.isFile())
    return refuse(`Error: "${absolute}" is not a regular file, so it is not read.`)
  if (info.size > MAX_FILE_BYTES) {
    return refuse(
      `Error: "${absolute}" is larger than the ${MAX_FILE_BYTES / 1024 / 1024} MB a token file ` +
        'may be, so nothing was read.'
    )
  }
  return Bun.file(absolute).text()
}

const readFiles = async (root: string, paths: readonly string[]) =>
  Promise.all(paths.map(async (path) => ({ path, text: await readTokenFile(root, path) })))

/** The `components/` folders the Claude Design format keeps for itself, never components. */
const NON_COMPONENT_FOLDERS = new Set(['lib', 'src'])

/** The files that make a `components/<Comp>/` folder a component card. */
const CARD_FILES = new Set(['preview.html', 'README.md', 'index.html', 'usage.md'])

/** `components/<Comp>.html` and `components/<Comp>.prompt.md`, the single-file spellings. */
const SINGLE_FILE_CARD = /^(.+?)\.(?:html|prompt\.md)$/

/** The bundle header is on line 1; it is never larger than this. */
const MAX_HEADER_BYTES = 256 * 1024

/** The entries of a folder, links included as links; none when it is not there. */
const entriesOf = async (folder: string) =>
  (await readdir(folder, { withFileTypes: true }).catch(unlessAbsent)) ?? []

/** Whether a folder name is one the format or a build left behind (`lib`, `_preview`, `.git`). */
const isNonComponentFolder = (name: string): boolean =>
  NON_COMPONENT_FOLDERS.has(name) || name.startsWith('_') || name.startsWith('.')

/**
 * The component a `components/<name>/` folder holds: itself when it holds a
 * card file, else each `<group>/<Comp>/` beneath it holding `<Comp>.html` or
 * `<Comp>.prompt.md` (design-sync's two-level layout). A folder of types only
 * holds none.
 */
const folderComponents = async (components: string, name: string): Promise<readonly string[]> => {
  const entries = await entriesOf(join(components, name))
  if (entries.some((entry) => entry.isFile() && CARD_FILES.has(entry.name))) return [name]
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !isNonComponentFolder(entry.name))
      .map(async (entry) => {
        const files = await entriesOf(join(components, name, entry.name))
        const own = new Set([`${entry.name}.html`, `${entry.name}.prompt.md`])
        return files.some((file) => file.isFile() && own.has(file.name)) ? [entry.name] : []
      })
  )
  return nested.flat()
}

/** The names `components/bundle.js` declares in its `@ds-bundle` header, on line 1. */
const bundleHeaderNames = async (components: string): Promise<readonly string[]> => {
  const path = join(components, 'bundle.js')
  const info = await lstat(path).catch(unlessAbsent)
  if (info?.isFile() !== true) return []
  const firstLine = (await Bun.file(path).slice(0, MAX_HEADER_BYTES).text()).split('\n')[0] ?? ''
  const header = /@ds-bundle:\s*(\{.*\})\s*\*\//.exec(firstLine)?.[1]
  const parsed = header === undefined ? undefined : parseJson(header)
  const listed =
    typeof parsed === 'object' && parsed !== null && 'components' in parsed
      ? parsed.components
      : undefined
  return (Array.isArray(listed) ? listed : []).flatMap((component: unknown) =>
    typeof component === 'object' &&
    component !== null &&
    'name' in component &&
    typeof component.name === 'string'
      ? [component.name]
      : []
  )
}

/**
 * How many components a `components/` folder beside the tokens holds, each
 * name once, by the Claude Design 0.2.47 definition: a `<Comp>/` folder with a
 * preview or a README, the single-file `<Comp>.html` and `<Comp>.prompt.md`,
 * design-sync's `<group>/<Comp>/`, and the names `bundle.js`'s header lists.
 * The walk is two levels deep and never follows a symbolic link.
 */
const countComponents = async (root: string): Promise<number> => {
  const components = join(root, 'components')
  // No `components/` folder is the common case, and means none were found.
  const entries = await entriesOf(components)
  const singleFiles = entries.flatMap((entry) => {
    const name = entry.isFile() ? SINGLE_FILE_CARD.exec(entry.name)?.[1] : undefined
    return name === undefined ? [] : [name]
  })
  const folders = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !isNonComponentFolder(entry.name))
      .map((entry) => folderComponents(components, entry.name))
  )
  const names = [...singleFiles, ...folders.flat(), ...(await bundleHeaderNames(components))]
  return new Set(names).size
}

const readFolder = async (path: string): Promise<ReadSource> => {
  const files = await readFiles(path, await listTokenFiles(path))
  return {
    path,
    source: { entry: undefined, files },
    components: await countComponents(path),
    isFolder: true,
  }
}

/**
 * The files a resolver names that are regular files inside its folder. One it
 * names but the folder lacks (or that climbs out of it) is not read, and the
 * adapter refuses the import naming it.
 */
const resolverSiblings = async (root: string, entry: string, text: string) => {
  const inside = resolverFileRefs(parseJson(text)).filter((path) => {
    const rel = relative(root, resolve(root, path))
    return path !== entry && rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  })
  const present = await Promise.all(
    inside.map(async (path) => {
      const info = await lstat(join(root, path)).catch(unlessAbsent)
      return info?.isFile() === true ? [toPosix(path)] : []
    })
  )
  return readFiles(root, present.flat())
}

const readFile = async (path: string): Promise<ReadSource> => {
  const root = dirname(path)
  const entry = basename(path)
  const text = await readTokenFile(root, entry, true)
  const siblings = isDtcgResolver(parseJson(text)) ? await resolverSiblings(root, entry, text) : []
  return {
    path,
    source: { entry, files: [{ path: entry, text }, ...siblings] },
    components: await countComponents(root),
    isFolder: false,
  }
}

/**
 * Read the source named on the command line, refusing a URL and a path that
 * holds nothing.
 */
export const readImportSourcePath = async (raw: string): Promise<ReadSource> => {
  if (URL_SOURCE.test(raw)) {
    return refuse(
      `Error: "${raw}" is a URL. design-system import reads a local file or folder only.\n\n` +
        '  Download the export first, then import the local path. The import makes no network call.'
    )
  }
  const path = resolve(process.cwd(), raw)
  const info = await stat(path).catch(unlessAbsent)
  if (info === undefined) return refuse(`Error: No file or folder at "${raw}".`)
  return info.isDirectory() ? readFolder(path) : readFile(path)
}
