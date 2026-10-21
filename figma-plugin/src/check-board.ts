/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CHECK: which layers the import would refuse or report, before the designer
 * exports — off-scale values with the nearest token named, and layers that are
 * no kit component.
 *
 * The verdict is NOT re-implemented here. Each board is read back exactly as
 * the export reads it, then handed to the CLI's own reader,
 * `readFigmaPageDocument` (`figma-pages-parse.ts`), the function the import
 * runs. Its `offScale` and `notAKitComponent` lists ARE this report, so the
 * plugin cannot call a value on the scale that the import then refuses, or the
 * other way round. To map each finding back to its Figma layer, the board is
 * relabelled before the read — every layer named by its Figma id, every
 * tagged layer given an id of its own — which changes no verdict: the reader
 * decides on values, tags and nesting, never on names or ids.
 *
 * The check highlights (selects) layers and names the nearest token. It never
 * changes a layer: snapping a value to the scale is deliberately not offered,
 * so no function here writes to Figma.
 */

import type {
  FigmaPageDocument,
  FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { figmaVariableName } from '@/domain/models/app/design/adapters/pages/figma-pages-layout'
import {
  readFigmaPageDocument,
  type FigmaPageScale,
} from '@/domain/models/app/design/adapters/pages/figma-pages-parse'
import type { FigmaPort, PortVariable } from './figma-port'
import { readBoards } from './read-board'

/** One finding: a layer the import would refuse to place, or a value it would report. */
export interface CheckFinding {
  readonly kind: 'off-scale' | 'not-a-kit-component'
  readonly page: string
  readonly breakpoint: string
  /** The Figma layer, to select it. */
  readonly layerId: string
  readonly layerName: string
  /** For an off-scale value: the layout property, `gap`, `padding` or `width`. */
  readonly property?: string | undefined
  /** As drawn, in px. */
  readonly value?: string | undefined
  /** The closest declared spacing step (`spacing.4`) and its Figma variable (`spacing/4`). */
  readonly nearestToken?: string | undefined
  readonly nearestVariable?: string | undefined
}

/** What a check found. */
export interface CheckReport {
  readonly findings: readonly CheckFinding[]
  /** How many spacing steps the file's local variables declare; zero means nothing can be on the scale. */
  readonly spacingSteps: number
  readonly warnings: readonly string[]
}

const SPACING = /^spacing\/(.+)$/

/** The spacing scale the file's local variables declare, each step's px in its collection's default mode. */
export const scaleOfVariables = async (
  figma: FigmaPort,
  variables: readonly PortVariable[]
): Promise<FigmaPageScale> => {
  const steps = await Promise.all(
    variables.map(async (variable) => {
      const step = SPACING.exec(variable.name)?.[1]
      if (step === undefined || variable.resolvedType !== 'FLOAT') return undefined
      const collection = await figma.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId
      )
      const value =
        collection === null ? undefined : variable.valuesByMode[collection.defaultModeId]
      return typeof value === 'number' ? ([step, `${value}px`] as const) : undefined
    })
  )
  // The first collection declaring a step wins, as the build binds the first variable of a name.
  return {
    spacing: steps.reduce<Record<string, string>>(
      (acc, entry) =>
        entry === undefined || entry[0] in acc ? acc : { ...acc, [entry[0]]: entry[1] },
      {}
    ),
  }
}

const CHECK_PAGE = 'check'

/** A Figma id as one JSON Pointer segment (RFC 6901). */
const pointerOf = (id: string): string => id.replaceAll('~', '~0').replaceAll('/', '~1')
const idOfPointer = (segment: string): string => segment.replaceAll('~1', '/').replaceAll('~0', '~')

/** The board relabelled: names are Figma ids, every tag carries an id of its own. */
const relabelled = (
  nodes: readonly FigmaPageNode[],
  layerOf: ReadonlyMap<FigmaPageNode, string>
): readonly FigmaPageNode[] =>
  nodes.map((node) => {
    const id = layerOf.get(node) ?? ''
    return {
      ...node,
      name: id,
      ...(node.sovrium === undefined
        ? {}
        : { sovrium: { id: `${CHECK_PAGE}:/${pointerOf(id)}`, type: node.sovrium.type } }),
      children: relabelled(node.children, layerOf),
    }
  })

const namesOf = (layerOf: ReadonlyMap<FigmaPageNode, string>): ReadonlyMap<string, string> =>
  new Map([...layerOf].map(([node, id]) => [id, node.name]))

/** The findings of one board, read by the CLI's reader as if it were the base board. */
const boardFindings = (
  document: FigmaPageDocument,
  board: FigmaPageDocument['boards'][number],
  layerOf: ReadonlyMap<FigmaPageNode, string>,
  scale: FigmaPageScale
): readonly CheckFinding[] => {
  const names = namesOf(layerOf)
  const reading = readFigmaPageDocument(
    {
      ...document,
      page: CHECK_PAGE,
      boards: [{ breakpoint: 'base', width: board.width, nodes: relabelled(board.nodes, layerOf) }],
      exported: [],
    },
    scale
  )
  if (!reading.ok) return []
  const where = { page: document.page, breakpoint: board.breakpoint }
  return [
    ...reading.value.offScale.map((entry): CheckFinding => {
      const layerId = idOfPointer(entry.node.slice(`${CHECK_PAGE}:/`.length))
      return {
        kind: 'off-scale',
        ...where,
        layerId,
        layerName: names.get(layerId) ?? layerId,
        property: entry.property.replace(/^layout\./, ''),
        value: entry.value,
        nearestToken: entry.nearestToken,
        nearestVariable:
          entry.nearestToken === undefined ? undefined : figmaVariableName(entry.nearestToken),
      }
    }),
    ...reading.value.notAKitComponent.map((layer): CheckFinding => ({
      kind: 'not-a-kit-component',
      ...where,
      layerId: layer.name,
      layerName: names.get(layer.name) ?? layer.name,
    })),
  ]
}

/** Check every Sovrium page drawn on the current Figma page. Reads only. */
export const checkBoards = async (figma: FigmaPort): Promise<CheckReport> => {
  const scale = await scaleOfVariables(figma, await figma.variables.getLocalVariablesAsync())
  const read = await readBoards(figma)
  return {
    findings: read.pages.flatMap(({ document, layerOf }) =>
      document.boards.flatMap((board) => boardFindings(document, board, layerOf, scale))
    ),
    spacingSteps: Object.keys(scale.spacing).length,
    warnings: read.warnings,
  }
}
