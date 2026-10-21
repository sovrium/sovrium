/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isObject,
  parseJson,
} from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import { MIGRATION_PAGE_FACTS } from './migrated-page-mapping'
import {
  readToolScript,
  stringAttribute,
  type RsxElement,
  type RsxLimits,
  RSX_LIMITS,
} from './retool-toolscript-read'

/**
 * The read half of the Retool classic page migration: the files of a
 * ToolScript ZIP, already inflated within the import's limits, read into the
 * app's screens, its shared header and their grid positions. Which kit node a
 * component becomes is `retool-classic-page-mappings.ts`'s alone.
 *
 * ─── THE GATE IS THE FORMAT ────────────────────────────────────────────────
 *
 * Any ToolScript ZIP is read, from Retool Cloud or a self-hosted Retool: the
 * ZIP does not say which wrote it. It must hold a `main.rsx` (at its root or
 * one folder down) and a `metadata.json` whose `toolscriptVersion` is one a
 * pinned export writes ({@link TOOLSCRIPT_VERSIONS}, fact b2b). Anything else
 * is refused, naming the pinned facts, never guessed through.
 *
 * ─── READ AGAINST THE REAL EXPORT ──────────────────────────────────────────
 *
 * The pinned export (`export-sample/toolscript/`) writes `main.rsx` as an
 * `<App>` that stitches its files in with `<Include src>` (the docs spell it
 * `<Import>`, fact b5: both are read). Each page is a `src/<screenId>.rsx`
 * holding one `<Screen>`: its queries, then its `$main` frame. The shared
 * header is `header.rsx`, a `$header` frame. Grid positions are dotfiles under
 * `.positions/`: one `.<screenId>.positions.json` per screen and
 * `.global_positions.json` for the header (fact b3). A file is included only
 * from inside the app's root, as Retool itself requires.
 */

/** The ToolScript versions a pinned export writes. */
export const TOOLSCRIPT_VERSIONS: readonly string[] = ['1.0.0']

/** How deep `<Include>`s may nest, and how many files one app may stitch. */
const MAX_INCLUDE_DEPTH = 8
const MAX_INCLUDED_FILES = 1000

/** One file of the export, inflated, by its path inside the ZIP. */
export interface RetoolExportEntry {
  readonly path: string
  readonly bytes: Uint8Array
}

/** Where a component sits on its frame's 12-column grid (fact b3); a key at its default is omitted. */
export interface RetoolPosition {
  readonly row: number
  readonly col: number
  readonly width: number
}

/** A component's position by its id. */
export type RetoolPositions = ReadonlyMap<string, RetoolPosition>

/** A query a screen declares: data, not page, named for the data migration. */
export interface RetoolQuery {
  readonly id: string
  readonly type: string
  readonly file: string | undefined
}

/** One screen of the app: a page. */
export interface RetoolScreen {
  readonly id: string
  readonly title: string | undefined
  readonly urlSlug: string | undefined
  /** The export entry the screen was read from. */
  readonly file: string
  /** The components of its main frames, in order. */
  readonly components: readonly RsxElement[]
  readonly queries: readonly RetoolQuery[]
  readonly positions: RetoolPositions
}

/** The app a ToolScript ZIP holds. */
export interface RetoolApp {
  readonly screens: readonly RetoolScreen[]
  /** The components of the shared header frame, written at the top of each page. */
  readonly header: readonly RsxElement[]
  readonly headerPositions: RetoolPositions
}

export type RetoolExportRead =
  { readonly ok: true; readonly app: RetoolApp } | { readonly ok: false; readonly reason: string }

type Failed = { readonly ok: false; readonly reason: string }

const FACTS = MIGRATION_PAGE_FACTS['retool-classic']

const decoder = new TextDecoder('utf-8')

const MAIN = /^(?:([^/]+)\/)?main\.rsx$/

/** A path normalised against `from`'s folder, or `undefined` when it leaves the app's root. */
export const resolveAppPath = (from: string, target: string): string | undefined => {
  if (target.startsWith('/') || target.includes('\\')) return undefined
  const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/')).split('/') : []
  const resolved = target.split('/').reduce<readonly string[] | undefined>((parts, segment) => {
    if (parts === undefined || segment === '.' || segment === '') return parts
    if (segment !== '..') return [...parts, segment]
    return parts.length === 0 ? undefined : parts.slice(0, -1)
  }, base)
  return resolved === undefined || resolved.length === 0 ? undefined : resolved.join('/')
}

/** The files of the app, by their path from its root. */
interface AppFiles {
  readonly files: ReadonlyMap<string, Uint8Array>
}

/** A file's text; the decoder drops a leading byte-order mark. */
const textOf = (bytes: Uint8Array): string => decoder.decode(bytes)

/** The app's root folder inside the ZIP, `''` at the top, or `undefined` with no `main.rsx`. */
const rootOf = (entries: readonly RetoolExportEntry[]): string | undefined => {
  const mains = entries.flatMap((entry) => {
    const match = MAIN.exec(entry.path)
    return match === null ? [] : [match[1] === undefined ? '' : `${match[1]}/`]
  })
  return mains.includes('') ? '' : mains.toSorted()[0]
}

const filesUnder = (entries: readonly RetoolExportEntry[], root: string): AppFiles => ({
  files: new Map(
    entries
      .filter((entry) => entry.path.startsWith(root))
      .map((entry) => [entry.path.slice(root.length), entry.bytes] as const)
  ),
})

/** The metadata gate: a `toolscriptVersion` a pinned export writes. */
const checkVersion = (app: AppFiles): Failed | undefined => {
  const bytes = app.files.get('metadata.json')
  const metadata = bytes === undefined ? undefined : parseJson(textOf(bytes))
  const version = isObject(metadata) ? metadata['toolscriptVersion'] : undefined
  const known = TOOLSCRIPT_VERSIONS.join(', ')
  if (typeof version !== 'string') {
    return {
      ok: false,
      reason: `holds no metadata.json naming its toolscriptVersion, which the pinned Retool facts (${FACTS}) read; the import reads ToolScript ${known}`,
    }
  }
  return TOOLSCRIPT_VERSIONS.includes(version)
    ? undefined
    : {
        ok: false,
        reason: `names ToolScript version ${JSON.stringify(version)} in metadata.json, which the pinned Retool facts (${FACTS}) do not describe; the import reads ToolScript ${known}`,
      }
}

/** One element, read from `file`, tagged with the file it came from. */
export interface SourcedElement {
  readonly element: RsxElement
  readonly file: string
}

/** What every stitch reads: the app's files and the bounds of one file. */
interface StitchContext {
  readonly app: AppFiles
  readonly limits: RsxLimits
}

/**
 * Elements stitched so far, and every file read so far across every branch:
 * a file is read at most once, so stitching costs no more than the ZIP holds.
 */
type Stitched =
  | {
      readonly ok: true
      readonly elements: readonly SourcedElement[]
      readonly seen: readonly string[]
    }
  | Failed

const isInclude = (element: RsxElement): boolean =>
  element.type === 'Include' || element.type === 'Import'

/** One `.rsx` file read and its own includes stitched in, each element tagged with its file. */
const stitchFile = (
  file: string,
  depth: number,
  seen: readonly string[],
  context: StitchContext
): Stitched => {
  if (seen.includes(file)) return { ok: false, reason: `includes ${file} more than once` }
  if (depth > MAX_INCLUDE_DEPTH || seen.length >= MAX_INCLUDED_FILES) {
    return {
      ok: false,
      reason: `stitches its files more than ${MAX_INCLUDE_DEPTH} includes deep, or more than ${MAX_INCLUDED_FILES} files`,
    }
  }
  const bytes = context.app.files.get(file)
  if (bytes === undefined)
    return { ok: false, reason: `includes ${file}, which the ZIP does not hold` }
  const read = readToolScript(textOf(bytes), context.limits)
  if (!read.ok) return { ok: false, reason: `has a ${file} that ${read.reason}` }
  return stitchElements(read.elements, { file, depth }, [...seen, file], context)
}

/** Where elements were read: their file, and how many includes deep it is. */
interface Origin {
  readonly file: string
  readonly depth: number
}

/** Elements with every `<Include>` among them, at any depth, replaced by its file's elements. */
const stitchElements = (
  elements: readonly RsxElement[],
  origin: Origin,
  seen: readonly string[],
  context: StitchContext
): Stitched =>
  elements.reduce<Stitched>(
    (acc, element) => {
      if (!acc.ok) return acc
      const stitched = isInclude(element)
        ? stitchInclude(element, origin, acc.seen, context)
        : stitchChildren(element, origin, acc.seen, context)
      return stitched.ok
        ? { ok: true, elements: [...acc.elements, ...stitched.elements], seen: stitched.seen }
        : stitched
    },
    { ok: true, elements: [], seen }
  )

const stitchInclude = (
  element: RsxElement,
  origin: Origin,
  seen: readonly string[],
  context: StitchContext
): Stitched => {
  const src = stringAttribute(element, 'src') ?? ''
  const target = resolveAppPath(origin.file, src)
  return target === undefined
    ? {
        ok: false,
        reason: `includes ${JSON.stringify(src)} from ${origin.file}, a path outside the app`,
      }
    : stitchFile(target, origin.depth + 1, seen, context)
}

const stitchChildren = (
  element: RsxElement,
  origin: Origin,
  seen: readonly string[],
  context: StitchContext
): Stitched => {
  const children = stitchElements(element.children, origin, seen, context)
  if (!children.ok) return children
  const stitched = { ...element, children: children.elements.map((child) => child.element) }
  return { ok: true, elements: [{ element: stitched, file: origin.file }], seen: children.seen }
}

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** A `.positions` file read into positions by component id; anything unreadable is no position. */
const positionsOf = (app: AppFiles, file: string): RetoolPositions => {
  const bytes = app.files.get(file)
  const parsed = bytes === undefined ? undefined : parseJson(textOf(bytes))
  if (!isObject(parsed)) return new Map()
  return new Map(
    Object.entries(parsed).flatMap(([id, entry]) =>
      isObject(entry)
        ? [
            [
              id,
              {
                row: finiteOr(entry['row'], 0),
                col: finiteOr(entry['col'], 0),
                width: finiteOr(entry['width'], 12),
              },
            ] as const,
          ]
        : []
    )
  )
}

const isFrame = (element: RsxElement, kind: 'main' | 'header'): boolean => {
  if (element.type !== 'Frame') return false
  const type = stringAttribute(element, 'type')
  const id = stringAttribute(element, 'id') ?? ''
  return type === undefined ? id.startsWith(`$${kind}`) : type === kind
}

const queryOf = (element: RsxElement, file: string): RetoolQuery => {
  const query = element.attributes.get('query')
  return {
    id: stringAttribute(element, 'id') ?? element.type,
    type: element.type,
    file: query?.kind === 'include' ? resolveAppPath(file, query.path) : undefined,
  }
}

/** A screen element read into a page. */
const screenOf = (sourced: SourcedElement, app: AppFiles): RetoolScreen => {
  const { element, file } = sourced
  const id = stringAttribute(element, 'id') ?? 'screen'
  const frames = element.children.filter((child) => child.type === 'Frame')
  return {
    id,
    title:
      stringAttribute(element, 'title') || stringAttribute(element, 'browserTitle') || undefined,
    urlSlug: stringAttribute(element, 'urlSlug') || undefined,
    file,
    components: frames
      .filter((frame) => !isFrame(frame, 'header'))
      .flatMap((frame) => frame.children),
    queries: element.children
      .filter((child) => child.type !== 'Frame')
      .map((child) => queryOf(child, file)),
    positions: positionsOf(app, `.positions/.${id}.positions.json`),
  }
}

/** The page an app with a main frame and no screen is: one screen named `main`. */
const singleScreenOf = (mains: readonly SourcedElement[]): SourcedElement => ({
  element: {
    type: 'Screen',
    attributes: new Map([['id', { kind: 'string', value: 'main' }]]),
    children: mains.map((main) => main.element),
  },
  file: mains[0]?.file ?? 'main.rsx',
})

/** The app `main.rsx` holds: its screens, or one page for an app with a main frame and no screen. */
const appOf = (top: readonly RsxElement[], context: StitchContext): RetoolExportRead => {
  const [root] = top
  if (top.length !== 1 || root?.type !== 'App') {
    return {
      ok: false,
      reason: `has a main.rsx that is not one <App>, which the pinned Retool facts (${FACTS}) describe`,
    }
  }
  const stitched = stitchElements(
    root.children,
    { file: 'main.rsx', depth: 0 },
    ['main.rsx'],
    context
  )
  if (!stitched.ok) return stitched
  const children = stitched.elements
  const screens = children.filter((child) => child.element.type === 'Screen')
  const mains = children.filter((child) => isFrame(child.element, 'main'))
  const pages = screens.length === 0 && mains.length > 0 ? [singleScreenOf(mains)] : screens
  return {
    ok: true,
    app: {
      screens: pages.map((screen) => screenOf(screen, context.app)),
      header: children
        .filter((child) => isFrame(child.element, 'header'))
        .flatMap((child) => child.element.children),
      headerPositions: positionsOf(context.app, '.positions/.global_positions.json'),
    },
  }
}

/**
 * Read a ToolScript ZIP's files into the app they hold.
 *
 * @param entries - the export's files, inflated.
 * @param limits - the bounds each `.rsx` file is read within.
 */
export const readRetoolClassicExport = (
  entries: readonly RetoolExportEntry[],
  limits: RsxLimits = RSX_LIMITS
): RetoolExportRead => {
  const root = rootOf(entries)
  if (root === undefined) {
    return {
      ok: false,
      reason:
        'holds no main.rsx, so it is not a ToolScript export: export the app as the ToolScript ZIP that Retool Cloud, or a self-hosted Retool at 3.6.0 or later, writes',
    }
  }
  const app = filesUnder(entries, root)
  const version = checkVersion(app)
  if (version !== undefined) return version
  const main = readToolScript(textOf(app.files.get('main.rsx') ?? new Uint8Array()), limits)
  return main.ok
    ? appOf(main.elements, { app, limits })
    : { ok: false, reason: `has a main.rsx that ${main.reason}` }
}
