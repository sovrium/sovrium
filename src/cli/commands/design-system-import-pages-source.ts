/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages` — finding the page drawing a design
 * tool exported, and telling which tool it came from.
 *
 * A source is a LOCAL path: a Figma page document (`<page>.figma.json`, which
 * the Sovrium Figma plugin writes), a Penpot file (`.penpot`), a Claude Design
 * canvas project folder (`canvas.json` beside its boards), or a whole bundle
 * folder, which holds all three and so needs `--from` to say which. A URL is
 * refused before anything is read: the import calls no network.
 *
 * ─── ONE VIEW, TWO ROOTS ───────────────────────────────────────────────────
 *
 * Files are read through a {@link PageSourceView}: the disk under the path the
 * operator named, or the files of a bundle built in memory. The import reads
 * the operator's drawing through the first and the BASELINE — the same tool's
 * file in an unedited export of the config — through the second, by the same
 * code, so the two are read alike.
 *
 * Below the root a symbolic link is never followed, a path that climbs out of
 * the root is never read, and a file past {@link MAX_FILE_BYTES} is refused
 * rather than truncated.
 */

import { lstat, readdir, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { refuse } from './app-prelude'

/** The design tools whose page drawings the import reads, as `--from` names them. */
export const PAGE_FORMATS = ['claude-design', 'figma', 'penpot'] as const

/** One of {@link PAGE_FORMATS}. */
export type PageFormat = (typeof PAGE_FORMATS)[number]

/** A page drawing file past this size is refused: an export of a few pages never weighs that. */
const MAX_FILE_BYTES = 32 * 1024 * 1024

/** `scheme://…` — what a URL looks like, as opposed to a local path. */
const URL_SOURCE = /^[a-z][a-z0-9+.-]*:\/\//i

/** The Figma page document's format identifier, read off its first bytes. */
const FIGMA_PAGE_FORMAT = 'sovrium.figma.page'

/** Where each tool's files sit inside a design-system bundle. */
export const BUNDLE_LOCATIONS: Readonly<Record<PageFormat, string>> = {
  'claude-design': 'adapters/claude-design/canvas',
  figma: 'adapters/figma/pages',
  penpot: 'adapters/penpot',
}

/** Read access to the files under one root, by `/`-separated path relative to it. */
export interface PageSourceView {
  /** A file's bytes, or `undefined` when there is no regular file there. */
  readonly read: (path: string) => Promise<Uint8Array | undefined>
  /** The names of the regular files directly inside a folder (`''` is the root). */
  readonly list: (folder: string) => Promise<readonly string[]>
}

/** The page drawing a source holds: its tool, where it is, and the view it is read through. */
export interface LocatedPageSource {
  /** The path as the operator named it, resolved. */
  readonly path: string
  readonly format: PageFormat
  /** Whether `--from` chose the tool rather than detection. */
  readonly forced: boolean
  readonly view: PageSourceView
  /** The tool's files, relative to the view: one per page, or the canvas folder. */
  readonly files: readonly string[]
}

const toPosix = (path: string): string => path.split(sep).join('/')

/** Whether a `/`-separated relative path stays inside its root. */
const staysInside = (path: string): boolean => {
  const normalised = normalize(path)
  return normalised !== '..' && !normalised.startsWith(`..${sep}`) && !isAbsolute(normalised)
}

const isAbsent = (error: unknown): undefined => {
  const code = (error as { readonly code?: unknown } | undefined)?.code
  if (code === 'ENOENT' || code === 'ENOTDIR') return undefined
  throw error
}

/**
 * Whether `folder` (relative to `root`, `''` being the root) and every folder
 * between them is a real folder: a symbolic link anywhere below the root would
 * let a name the drawing writes, such as a canvas board's, reach a file
 * outside it.
 */
const isRealFolder = async (root: string, folder: string): Promise<boolean> => {
  const segments = normalize(folder)
    .split(sep)
    .filter((segment) => segment !== '' && segment !== '.')
  const infos = await Promise.all(
    segments.map((_, index) => lstat(join(root, ...segments.slice(0, index + 1))).catch(isAbsent))
  )
  return infos.every((info) => info?.isDirectory() === true)
}

/** The disk under `root`, links never followed and nothing outside it read. */
export const diskView = (root: string): PageSourceView => ({
  read: async (path) => {
    if (!staysInside(path) || !(await isRealFolder(root, dirname(path)))) return undefined
    const absolute = join(root, path)
    const info = await lstat(absolute).catch(isAbsent)
    if (info?.isFile() !== true) return undefined
    if (info.size > MAX_FILE_BYTES) {
      return refuse(
        `Error: "${absolute}" is larger than the ${MAX_FILE_BYTES / 1024 / 1024} MB a page drawing ` +
          'may be, so nothing was read.'
      )
    }
    return new Uint8Array(await Bun.file(absolute).arrayBuffer())
  },
  list: async (folder) => {
    if (!staysInside(folder === '' ? '.' : folder)) return []
    if (!(await isRealFolder(root, folder))) return []
    const entries =
      (await readdir(join(root, folder), { withFileTypes: true }).catch(isAbsent)) ?? []
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .toSorted()
  },
})

/** The files of a bundle built in memory, as a view. */
export const bundleView = (
  files: readonly { readonly path: string; readonly bytes: Uint8Array }[]
): PageSourceView => {
  const byPath = new Map(files.map((file) => [file.path, file.bytes] as const))
  return {
    read: async (path) => byPath.get(path),
    list: async (folder) =>
      files
        .map((file) => file.path)
        .filter((path) => dirname(path) === (folder === '' ? '.' : folder))
        .map((path) => basename(path))
        .toSorted(),
  }
}

const joinPath = (folder: string, name: string): string =>
  folder === '' ? name : `${folder}/${name}`

/** Whether the bytes of a JSON file name the Figma page document format. */
const isFigmaPageBytes = (bytes: Uint8Array | undefined): boolean => {
  if (bytes === undefined) return false
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Readonly<Record<string, unknown>>)['format'] === FIGMA_PAGE_FORMAT
    )
  } catch {
    // Not JSON at all: certainly not a Figma page document.
    return false
  }
}

/** The tool's files in one folder of a view: page documents, Penpot files, or a canvas project. */
const filesIn = async (
  view: PageSourceView,
  folder: string,
  format: PageFormat
): Promise<readonly string[]> => {
  const names = await view.list(folder)
  if (format === 'claude-design') return names.includes('canvas.json') ? [folder] : []
  if (format === 'penpot') {
    return names.filter((name) => name.endsWith('.penpot')).map((name) => joinPath(folder, name))
  }
  const candidates = names
    .filter((name) => name.endsWith('.json'))
    .map((name) => joinPath(folder, name))
  const documents = await Promise.all(
    candidates.map(async (path) => (isFigmaPageBytes(await view.read(path)) ? [path] : []))
  )
  return documents.flat()
}

/** A tool's files in a folder source: at its root, or where a bundle keeps them. */
const filesOfFolder = async (
  view: PageSourceView,
  format: PageFormat
): Promise<readonly string[]> => {
  const own = await filesIn(view, '', format)
  return own.length > 0 ? own : filesIn(view, BUNDLE_LOCATIONS[format], format)
}

/** The tool a single file was exported by, if any. */
const formatOfFile = async (
  view: PageSourceView,
  name: string
): Promise<PageFormat | undefined> => {
  if (name.endsWith('.penpot')) return 'penpot'
  if (name.endsWith('.json') && isFigmaPageBytes(await view.read(name))) return 'figma'
  return undefined
}

const FORMAT_LIST = PAGE_FORMATS.join(', ')

const refuseNoDrawing = (path: string): never =>
  refuse(
    `Error: "${path}" is not a page drawing the import reads.\n\n` +
      `  Accepted page formats: ${FORMAT_LIST}.\n` +
      '  Pass the file or folder a design tool exported from the bundle, or name its tool with --from.'
  )

/** A single file, its tool detected or checked against `--from`. */
const locateFile = async (
  path: string,
  from: PageFormat | undefined
): Promise<LocatedPageSource> => {
  const view = diskView(dirname(path))
  const name = basename(path)
  const detected = await formatOfFile(view, name)
  const format = from ?? detected ?? refuseNoDrawing(path)
  if (format === 'claude-design') {
    return refuse(
      `Error: "${path}" is a file, and a Claude Design canvas project is a folder.\n\n` +
        '  Pass the folder holding canvas.json.'
    )
  }
  return { path, format, forced: from !== undefined, view, files: [name] }
}

/** A folder, its tool detected — refused when it holds more than one — or named by `--from`. */
const locateFolder = async (
  path: string,
  from: PageFormat | undefined
): Promise<LocatedPageSource> => {
  const view = diskView(path)
  if (from !== undefined) {
    const files = await filesOfFolder(view, from)
    if (files.length === 0) {
      return refuse(
        `Error: "${path}" holds no ${from} page drawing.\n\n  Accepted page formats: ${FORMAT_LIST}.`
      )
    }
    return { path, format: from, forced: true, view, files }
  }
  const found = await Promise.all(
    PAGE_FORMATS.map(async (format) => [format, await filesOfFolder(view, format)] as const)
  )
  const present = found.filter(([, files]) => files.length > 0)
  if (present.length > 1) {
    const names = present.map(([format]) => format)
    return refuse(
      `Error: "${path}" holds the page drawings of more than one tool: ${names.join(', ')}.\n\n` +
        `  Name the one to read with --from, e.g. --from ${names[0] ?? ''}.`
    )
  }
  const [only] = present
  if (only === undefined) return refuseNoDrawing(path)
  return { path, format: only[0], forced: false, view, files: only[1] }
}

/**
 * Find the page drawing a source names, refusing a URL, a missing path, a
 * path holding no page drawing, and a folder holding two tools' without
 * `--from`.
 *
 * @param raw - the source as the command line names it.
 * @param from - the tool `--from` names, if any.
 */
export const locatePageSource = async (
  raw: string,
  from: PageFormat | undefined
): Promise<LocatedPageSource> => {
  if (URL_SOURCE.test(raw)) {
    return refuse(
      `Error: "${raw}" is a URL. design-system import --pages reads a local file or folder only.\n\n` +
        '  Save the drawing from the design tool first, then import the local path. The import makes no network call.'
    )
  }
  const path = resolve(process.cwd(), raw)
  const info = await stat(path).catch(isAbsent)
  if (info === undefined) return refuse(`Error: No file or folder at "${raw}".`)
  return info.isDirectory() ? locateFolder(path, from) : locateFile(path, from)
}

/**
 * Whether a FILE named to the token import is a page drawing, which only
 * `--pages` reads. A folder is not judged: a bundle folder holds the tokens the
 * token import reads beside its page drawings.
 */
export const isPageDrawingFile = async (raw: string): Promise<boolean> => {
  if (URL_SOURCE.test(raw)) return false
  const path = resolve(process.cwd(), raw)
  const info = await stat(path).catch(isAbsent)
  if (info?.isFile() !== true) return false
  return (await formatOfFile(diskView(dirname(path)), basename(path))) !== undefined
}

/** The same tool's files inside a bundle, where an unedited export writes them. */
export const bundleFilesOf = async (
  view: PageSourceView,
  format: PageFormat
): Promise<readonly string[]> => filesIn(view, BUNDLE_LOCATIONS[format], format)

/** A path relative to the working directory, for a report line. */
export const displayPath = (path: string): string => {
  const rel = toPosix(relative(process.cwd(), path))
  return rel === '' || rel.startsWith('..') ? path : rel
}
