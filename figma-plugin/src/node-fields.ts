/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The contract's node fields as Figma layer properties: which fields are
 * scalars the plugin copies one for one, which values the contract accepts,
 * and which Figma node type each contract `nodeType` reads back as.
 *
 * Building and reading share this table, so a field the build sets is a field
 * the read writes back, under the same name and in the contract's own order.
 */

import type { FigmaPageNode } from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import type { DrawnValue } from './plugin-data'

/** A scalar contract field the plugin copies straight onto the Figma layer of the same name. */
export type ScalarField =
  | 'locked'
  | 'layoutMode'
  | 'itemSpacing'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'primaryAxisAlignItems'
  | 'counterAxisAlignItems'
  | 'layoutSizingHorizontal'
  | 'layoutSizingVertical'
  | 'layoutPositioning'
  | 'characters'

/** The scalar fields, in the order the contract declares them. */
export const SCALAR_FIELDS: readonly ScalarField[] = [
  'locked',
  'layoutMode',
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'layoutSizingHorizontal',
  'layoutSizingVertical',
  'layoutPositioning',
  'characters',
]

/** The auto-layout fields, set on a frame before its children are appended. */
export const AUTO_LAYOUT_FIELDS: readonly ScalarField[] = [
  'layoutMode',
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
]

/** The fields Figma only accepts once the layer sits in its parent (FILL and ABSOLUTE throw otherwise). */
export const PLACED_FIELDS: readonly ScalarField[] = [
  'layoutSizingHorizontal',
  'layoutSizingVertical',
  'layoutPositioning',
]

/** The values the contract accepts for each enumerated field; Figma may hold more (`GRID`). */
export const CONTRACT_VALUES: Readonly<Partial<Record<ScalarField, readonly string[]>>> = {
  layoutMode: ['HORIZONTAL', 'VERTICAL', 'NONE'],
  primaryAxisAlignItems: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'],
  counterAxisAlignItems: ['MIN', 'CENTER', 'MAX', 'BASELINE'],
  layoutSizingHorizontal: ['FIXED', 'HUG', 'FILL'],
  layoutSizingVertical: ['FIXED', 'HUG', 'FILL'],
  layoutPositioning: ['AUTO', 'ABSOLUTE'],
}

/** What each field reads as on a layer the plugin did not build, for telling an edit from a default. */
export const FIGMA_DEFAULTS: Readonly<Record<ScalarField, DrawnValue>> = {
  locked: false,
  layoutMode: 'NONE',
  itemSpacing: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  layoutSizingHorizontal: 'FIXED',
  layoutSizingVertical: 'FIXED',
  layoutPositioning: 'AUTO',
  characters: '',
}

/**
 * The contract `nodeType` a Figma layer type reads back as. The contract
 * names six; every other drawable type is folded into the nearest of them,
 * which only ever affects how the import REPORTS a layer that is no kit
 * component, never what it builds. `undefined` is a layer that is not drawn
 * (a slice), which the read skips.
 */
export const CONTRACT_NODE_TYPE: Readonly<Record<string, FigmaPageNode['nodeType'] | undefined>> = {
  FRAME: 'FRAME',
  COMPONENT: 'FRAME',
  COMPONENT_SET: 'FRAME',
  SECTION: 'FRAME',
  TEXT: 'TEXT',
  INSTANCE: 'INSTANCE',
  GROUP: 'GROUP',
  RECTANGLE: 'RECTANGLE',
  VECTOR: 'VECTOR',
  ELLIPSE: 'VECTOR',
  LINE: 'VECTOR',
  POLYGON: 'VECTOR',
  STAR: 'VECTOR',
  BOOLEAN_OPERATION: 'VECTOR',
  SLICE: undefined,
}

/** The contract node type of a Figma layer type; an unknown drawable type reads as a vector. */
export const contractNodeTypeOf = (figmaType: string): FigmaPageNode['nodeType'] | undefined =>
  figmaType in CONTRACT_NODE_TYPE ? CONTRACT_NODE_TYPE[figmaType] : 'VECTOR'

/** The contract fields a document node sets, for the drawn record. */
export const presentFieldsOf = (node: FigmaPageNode): readonly string[] => [
  ...SCALAR_FIELDS.filter((field) => node[field] !== undefined),
  ...(node.width === undefined ? [] : ['width']),
  ...(node.boundVariables === undefined ? [] : ['boundVariables']),
  ...(node.componentProperties === undefined ? [] : ['componentProperties']),
]
