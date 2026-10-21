/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which format a source is, and the adapter that reads it.
 *
 * Detection reads the source's SHAPE, never its file extension (every format
 * is `.json`): a `color.tokens` list is Claude Design, `$themes`/`$metadata`
 * is Tokens Studio, a `com.figma.*` extension is Figma, a resolver is DTCG.
 * Those four are decisive. Only when none applies does a weaker shape count: a
 * legacy `value`/`type` tree is Style Dictionary, `$value` leaves are DTCG,
 * and a `:root` / `.dark` / `@theme` block is CSS. A Figma or Style Dictionary
 * file in plain DTCG form is therefore DTCG, and reads the same either way.
 *
 * A source matching TWO formats is never settled by a precedence nobody can
 * see: the caller refuses it, naming both, and `--from` decides.
 *
 * Page drawings (`--pages`) are detected apart, by {@link detectPageImportFormats}:
 * a page document is no token file, so a token import never reads one, and
 * `--from figma` without `--pages` still means Figma's Variables files.
 */

import {
  fromClaudeDesignCanvas,
  isClaudeDesignCanvas,
  type ClaudeDesignCanvasParseOptions,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-parse'
import {
  PAGE_IMPORT_FORMATS,
  type PageDrawingParse,
  type PageImportFormat,
} from '@/domain/models/app/design/adapters/pages/page-drawing'
import { isFigmaPageDocument } from '../pages/figma-pages-parse'
import { fromPenpot, isPenpotExport } from '../pages/penpot-pages-parse'
import {
  isDtcgTree,
  isLegacyTree,
  parseJson,
  type AdapterResult,
  type ImportFormat,
  type ImportSource,
} from './canonical-tokens-service'
import { fromClaudeDesign, isClaudeDesignTokens } from './claude-design-import-service'
import { fromCss, isTokenStylesheet } from './css-import-service'
import { fromDtcg, isDtcgResolver } from './dtcg-import-service'
import { fromFigma, hasFigmaExtensions } from './figma-import-service'
import { fromStyleDictionary } from './style-dictionary-import-service'
import {
  fromTokensStudio,
  isTokensStudioDocument,
  isTokensStudioFolder,
} from './tokens-studio-import-service'

type Check = readonly [ImportFormat, boolean]

const formatsWhere = (checks: readonly Check[]): readonly ImportFormat[] =>
  checks.filter(([, present]) => present).map(([format]) => format)

const documentsOf = (source: ImportSource): readonly unknown[] =>
  source.files.filter((file) => !file.path.endsWith('.css')).map((file) => parseJson(file.text))

/** The decisive shapes: each names its format outright. */
const strongShapes = (
  source: ImportSource,
  documents: readonly unknown[]
): readonly ImportFormat[] =>
  formatsWhere([
    ['claude-design', documents.some(isClaudeDesignTokens)],
    [
      'tokens-studio',
      documents.some(isTokensStudioDocument) ||
        (source.entry === undefined && isTokensStudioFolder(source.files.map((file) => file.path))),
    ],
    ['figma', documents.some(hasFigmaExtensions)],
    ['dtcg', documents.some(isDtcgResolver)],
  ])

const isStylesheet = (path: string, text: string): boolean =>
  (path.endsWith('.css') || parseJson(text) === undefined) && isTokenStylesheet(text)

/** The shapes that count only when no decisive one applies. */
const weakShapes = (source: ImportSource, documents: readonly unknown[]): readonly ImportFormat[] =>
  formatsWhere([
    ['style-dictionary', documents.some(isLegacyTree)],
    ['dtcg', documents.some(isDtcgTree)],
    ['css', source.files.some((file) => isStylesheet(file.path, file.text))],
  ])

/**
 * The formats a source's shape matches: one is a detection, none means it is
 * not a token file, two or more means it is ambiguous.
 */
export const detectImportFormats = (source: ImportSource): readonly ImportFormat[] => {
  const documents = documentsOf(source)
  const strong = strongShapes(source, documents)
  return strong.length > 0 ? strong : weakShapes(source, documents)
}

const ADAPTERS: Readonly<Record<ImportFormat, (source: ImportSource) => AdapterResult>> = {
  'claude-design': fromClaudeDesign,
  figma: fromFigma,
  'tokens-studio': fromTokensStudio,
  'style-dictionary': fromStyleDictionary,
  dtcg: fromDtcg,
  css: fromCss,
}

/** Read a source as one format, through that format's adapter. */
export const readImportSource = (source: ImportSource, format: ImportFormat): AdapterResult =>
  ADAPTERS[format](source)

// ─── page mode (`design-system import --pages`) ───────────────────────────────
//
// A page drawing is read by a page adapter, never by a token adapter, so the
// two detections never meet: `--from claude-design` without `--pages` still
// reads the design-system project's tokens, and with `--pages` reads a canvas.
// A tool whose page parse has not shipped yet is simply never detected.

/** What a page drawing's shape says it is, per format. */
const PAGE_SHAPES: Readonly<Partial<Record<PageImportFormat, (source: ImportSource) => boolean>>> =
  {
    'claude-design': isClaudeDesignCanvas,
    figma: (source) => documentsOf(source).some(isFigmaPageDocument),
    penpot: (source) => isPenpotExport(source.files),
  }

/** The page parse of each format, each into the shared `PageDrawingParse`. */
const PAGE_ADAPTERS: Readonly<
  Partial<
    Record<
      PageImportFormat,
      (source: ImportSource, options: ClaudeDesignCanvasParseOptions) => PageDrawingParse
    >
  >
> = {
  'claude-design': fromClaudeDesignCanvas,
  penpot: fromPenpot,
}

/**
 * The page formats a source's shape matches: one is a detection, none means
 * it is no page drawing, two or more means it is ambiguous.
 */
export const detectPageImportFormats = (source: ImportSource): readonly PageImportFormat[] =>
  PAGE_IMPORT_FORMATS.filter((format) => PAGE_SHAPES[format]?.(source) === true)

/**
 * Read a source as one page format, or `undefined` when that format's page
 * parse is not available.
 */
export const readPageImportSource = (
  source: ImportSource,
  format: PageImportFormat,
  options: ClaudeDesignCanvasParseOptions = {}
): PageDrawingParse | undefined => PAGE_ADAPTERS[format]?.(source, options)
