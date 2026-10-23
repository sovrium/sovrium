/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  PageDesignTree,
  PageExportStamp,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import type {
  DrawnConflict,
  DrawnPage,
  DrawnPaint,
  DrawnRules,
} from '@/domain/models/app/pages/page-drawing'

/**
 * What every page adapter's PARSE half hands the page import: one design tree
 * per page a drawing holds, in the very shape the bundle writes as
 * `pages/<name>.tree.json`, beside the export stamp the drawing carried and
 * what it holds that cannot be read back. Each design tool's parse
 * (`claude-design-canvas-parse.ts`, and the Figma and Penpot ones) returns
 * this, so the merge reads one shape whatever drew the page.
 *
 * ─── A NODE THE DESIGNER ADDED ─────────────────────────────────────────────
 *
 * A kit component the export never drew has no path id. It is given
 * `<page>:/added/<n>`, `n` counting such nodes in drawing order from 0: a
 * pointer no page node can have, since every page node lives under
 * `/components`, so it can never be matched to one by path.
 */

/** The page drawing formats `design-system import --pages` reads. */
export type PageImportFormat = 'claude-design' | 'figma' | 'penpot'

/** Every page drawing format, in the order a refusal names them. */
export const PAGE_IMPORT_FORMATS: readonly PageImportFormat[] = ['claude-design', 'figma', 'penpot']

/** One thing a drawing holds that the import does not read back. */
export interface PageDrawingFinding {
  /** The drawing it is in: a board file, a Figma page, a Penpot page. */
  readonly board: string
  /** The node it was found on or under, by path id, when there is one. */
  readonly node?: string | undefined
  readonly detail: string
}

/** One page read back from its drawing. */
export interface ParsedPageDrawing {
  /** The drawing it was read from. */
  readonly board: string
  /** The page's design tree, in the shape of `pages/<name>.tree.json`. */
  readonly tree: PageDesignTree
  /** The export stamp the drawing carried. */
  readonly exported: PageExportStamp
  /** Whether the drawing still carried a valid stamp; without one, no node counts as deleted. */
  readonly stamped: boolean
  /** A value off the token scale, or a property the import does not read. */
  readonly offScale: readonly PageDrawingFinding[]
  /** Something drawn that is not a kit component. */
  readonly notAKitComponent: readonly PageDrawingFinding[]
  /** What each locked node draws inside, as a digest, by node id; only ever compared. */
  readonly drawings?: Readonly<Record<string, string>> | undefined
  /** Every layout property a node set in two places with two values. */
  readonly conflicts?: readonly DrawnConflict[] | undefined
  /** The colours and text size each node was drawn with, by node id. */
  readonly paints?: Readonly<Record<string, DrawnPaint>> | undefined
  /** What each node does, as the board carries it, by node id. */
  readonly rules?: Readonly<Record<string, DrawnRules>> | undefined
  /** What the board's root says of a page the config may not declare: its path, the page it is like. */
  readonly declares?: DrawnPage['declares']
}

/** A drawing source read back: each page, and each drawing or path refused. */
export interface PageDrawingParse {
  readonly format: PageImportFormat
  readonly pages: readonly ParsedPageDrawing[]
  readonly refused: readonly PageDrawingFinding[]
}

/** The pointer segment every added node's path id lives under. */
const ADDED_SEGMENT = 'added'

/** The path id of the `index`-th node a designer added to a page. */
export const addedNodeIdOf = (page: string, index: number): string =>
  `${page}:/${ADDED_SEGMENT}/${index}`

/** Whether a path id names a node a designer added, not one the export drew. */
export const isAddedNodeId = (id: string): boolean => {
  const colon = id.indexOf(':')
  return colon > 0 && id.slice(colon + 1).startsWith(`/${ADDED_SEGMENT}/`)
}
