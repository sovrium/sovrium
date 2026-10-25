/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page READERS of `sovrium design-system import --pages`, one per design
 * tool: each takes the tool's files through a view and returns the drawing of
 * every page they hold, in the one shape the merge reads (`page-drawing.ts`).
 *
 * A reader is the CLI's binding of a tool's parse half, which lives with the
 * tool's adapter; it reads bytes, hands them over, and converts the answer.
 * The import calls the same reader on the operator's drawing and on the
 * unedited export it builds in memory, so both are read alike.
 */

import { readOoxmlPackage } from '@/application/use-cases/automations/ooxml/ooxml-package'
import { parseHtmlElementTree, type HtmlNode } from '@/domain/kernel/sanitize/html-element-tree'
import { parseJson } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  canvasDrawnWithOf,
  type CanvasDrawnWith,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-drawn-with'
import { CANVAS_STAMP_FILE } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-export'
import { fromClaudeDesignCanvas } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-parse'
import { parseFigmaPage } from '@/domain/models/app/design/adapters/pages/figma-pages-parse'
import {
  penpotContainerOf,
  penpotContainerRefusal,
} from '@/domain/models/app/design/adapters/pages/penpot-pages-format'
import { parsePenpotFile } from '@/domain/models/app/design/adapters/pages/penpot-pages-parse'
import { drawnPageOfReading, type DrawnPage } from '@/domain/models/app/pages/page-drawing'
import type { PageFormat, PageSourceView } from './design-system-import-pages-source'
import type {
  PageDrawingFinding,
  ParsedPageDrawing,
} from '@/domain/models/app/design/adapters/pages/page-drawing'

/** What a drawing is read against: the token scale its lengths go back onto, and the kit. */
export interface PageReadScale {
  readonly spacing: Readonly<Record<string, string>>
  readonly kitTypes: ReadonlySet<string>
}

/** One drawing a reader read but could not take as a page, and why. */
export interface SkippedDrawing {
  readonly drawing: string
  readonly reason: string
}

/**
 * What a reader answers: every page it read and every drawing it set aside,
 * or why the files cannot be read at all.
 */
export type PageReadResult =
  | { readonly pages: readonly DrawnPage[]; readonly skipped?: readonly SkippedDrawing[] }
  | { readonly error: string }

/** One tool's reader. */
export type PageDrawingReader = (
  view: PageSourceView,
  files: readonly string[],
  scale: PageReadScale
) => Promise<PageReadResult>

const decoder = new TextDecoder()

/** The Sovrium Figma plugin's page documents, one page each. */
const readFigmaPages: PageDrawingReader = async (view, files, scale) => {
  const readings = await Promise.all(
    files.map(async (file): Promise<{ readonly page: DrawnPage } | { readonly error: string }> => {
      const bytes = await view.read(file)
      if (bytes === undefined) return { error: `${file} is not a regular file.` }
      const parsed = parseFigmaPage(decoder.decode(bytes), scale)
      return parsed.ok
        ? { page: drawnPageOfReading({ ...parsed.value, drawing: file }) }
        : { error: parsed.error }
    })
  )
  const errors = readings.flatMap((reading) => ('error' in reading ? [reading.error] : []))
  const [error] = errors
  if (error !== undefined) return { error }
  return { pages: readings.flatMap((reading) => ('page' in reading ? [reading.page] : [])) }
}

/** The text of an HTML document's `<title>`, or `undefined`. */
const documentTitleOf = (html: string): string | undefined => {
  const parsed = parseHtmlElementTree(html)
  if (!parsed.ok) return undefined
  const find = (nodes: readonly HtmlNode[]): string | undefined =>
    nodes.reduce<string | undefined>((found, node) => {
      if (found !== undefined || node.kind !== 'element') return found
      if (node.tag !== 'title') return find(node.children)
      return node.children.flatMap((child) => (child.kind === 'text' ? [child.text] : [])).join('')
    }, undefined)
  return find(parsed.nodes)
}

/** The board files a canvas index names, safe paths only. */
const boardNamesOf = (index: unknown): readonly string[] => {
  const boards = (index as { readonly boards?: unknown } | undefined)?.boards
  if (typeof boards !== 'object' || boards === null) return []
  return Object.keys(boards).filter(
    (name) => !name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..')
  )
}

/**
 * One board read back, as the drawing the merge reads: its title, its
 * locked nodes' digests, and what it holds that cannot be read. A canvas may
 * be a prototype, which shows samples where the export drew placeholders.
 */
const drawnPageOfBoard = (drawing: ParsedPageDrawing, text: string): DrawnPage => {
  const title = documentTitleOf(text)
  const pageNode = `${drawing.tree.page}:/components`
  const worded = (findings: readonly PageDrawingFinding[]) =>
    findings.map((finding) => ({ node: finding.node ?? pageNode, reason: finding.detail }))
  return drawnPageOfReading({
    tree: drawing.tree,
    exported: drawing.exported,
    drawing: drawing.board,
    samplesDrawn: true,
    ...(drawing.drawings === undefined ? {} : { drawings: drawing.drawings }),
    ...(drawing.paints === undefined ? {} : { paints: drawing.paints }),
    ...(drawing.rules === undefined ? {} : { rules: drawing.rules }),
    ...(drawing.declares === undefined ? {} : { declares: drawing.declares }),
    ...(title === undefined ? {} : { title }),
    reported: {
      notAKitComponent: worded(drawing.notAKitComponent),
      unread: worded(drawing.offScale),
      ...(drawing.conflicts === undefined ? {} : { conflicts: drawing.conflicts }),
    },
  })
}

/** The path of one file of a canvas project, inside the folder the source located it in. */
const canvasFileOf = (files: readonly string[], name: string): string => {
  const [folder = ''] = files
  return folder === '' ? name : `${folder}/${name}`
}

/** A Claude Design canvas project: its index and every board it names, read in one pass. */
const readCanvas: PageDrawingReader = async (view, files, scale) => {
  const at = (name: string): string => canvasFileOf(files, name)
  const indexBytes = await view.read(at('canvas.json'))
  if (indexBytes === undefined) return { error: 'The canvas project holds no canvas.json.' }
  const indexText = decoder.decode(indexBytes)
  const index = (() => {
    try {
      return JSON.parse(indexText) as unknown
    } catch {
      // Reported below as a canvas the parse cannot read.
      return undefined
    }
  })()
  const boards = await Promise.all(
    boardNamesOf(index).map(async (name) => {
      const bytes = await view.read(at(name))
      return bytes === undefined ? [] : [{ path: name, text: decoder.decode(bytes) }]
    })
  )
  // The stamp file beside the index says what each board drew when it was exported.
  const stampBytes = await view.read(at(CANVAS_STAMP_FILE))
  const source = {
    entry: undefined,
    files: [
      { path: 'canvas.json', text: indexText },
      ...(stampBytes === undefined
        ? []
        : [{ path: CANVAS_STAMP_FILE, text: decoder.decode(stampBytes) }]),
      ...boards.flat(),
    ],
  }
  const parsed = fromClaudeDesignCanvas(source, {
    spacing: scale.spacing,
    kitTypes: scale.kitTypes,
  })
  return {
    pages: parsed.pages.map((drawing) =>
      drawnPageOfBoard(
        drawing,
        source.files.find((file) => file.path === drawing.board)?.text ?? ''
      )
    ),
    skipped: parsed.refused.map((finding) => ({
      drawing: finding.board,
      reason: `${capitalised(finding.detail)}.`,
    })),
  }
}

/**
 * The drawing inputs a canvas's stamp file records (seed folder, instant,
 * record count, account, prototype kind); none for another tool's drawing or
 * a canvas exported before they were recorded.
 */
export const recordedDrawingOf = async (located: {
  readonly format: PageFormat
  readonly view: PageSourceView
  readonly files: readonly string[]
}): Promise<CanvasDrawnWith | undefined> => {
  if (located.format !== 'claude-design') return undefined
  const bytes = await located.view.read(canvasFileOf(located.files, CANVAS_STAMP_FILE))
  return bytes === undefined ? undefined : canvasDrawnWithOf(parseJson(decoder.decode(bytes)))
}

/** A finding's detail as the start of a sentence. */
const capitalised = (detail: string): string =>
  detail === '' ? detail : `${detail[0]?.toUpperCase() ?? ''}${detail.slice(1)}`

/**
 * What a Penpot archive may hold: a few pages draw a few hundred shapes, one
 * entry each, and a file far past that is refused before anything is inflated.
 */
const PENPOT_ARCHIVE_LIMITS = {
  maxEntries: 20_000,
  maxTotalUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200,
  ratioFloorBytes: 1024 * 1024,
}

/** Penpot files, each a ZIP opened within limits, every page holding a Sovrium board. */
const readPenpotFiles: PageDrawingReader = async (view, files, scale) => {
  const readings = await Promise.all(
    files.map(
      async (
        file
      ): Promise<{ readonly pages: readonly DrawnPage[] } | { readonly error: string }> => {
        const bytes = await view.read(file)
        if (bytes === undefined) return { error: `${file} is not a regular file.` }
        const container = penpotContainerOf(bytes)
        if (container !== 'zip') return { error: penpotContainerRefusal(container) }
        const archive = readOoxmlPackage(bytes, PENPOT_ARCHIVE_LIMITS)
        if (!archive.ok) return { error: `The Penpot file ${archive.message}.` }
        // Every name is handed over, so one climbing out of the archive refuses it;
        // only JSON entries are decoded, media and thumbnails are never read.
        const entries = archive.entries.map((entry) => ({
          path: entry.name,
          text: entry.name.endsWith('.json') ? decoder.decode(entry.bytes) : '',
        }))
        const parsed = parsePenpotFile(entries, { spacing: scale.spacing })
        return parsed.ok
          ? { pages: parsed.pages.map((page) => drawnPageOfReading(page.reading)) }
          : { error: parsed.error }
      }
    )
  )
  const [error] = readings.flatMap((reading) => ('error' in reading ? [reading.error] : []))
  if (error !== undefined) return { error }
  return { pages: readings.flatMap((reading) => ('pages' in reading ? reading.pages : [])) }
}

/** Every tool's reader, by the `--from` name of the tool. */
export const PAGE_READERS: Readonly<Partial<Record<PageFormat, PageDrawingReader>>> = {
  'claude-design': readCanvas,
  figma: readFigmaPages,
  penpot: readPenpotFiles,
}
