/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page documents the plugin's tests draw. The first is written by the
 * CLI's own export (`exportFigmaPage`), so the round trip is tested on exactly
 * what `sovrium design-system --format bundle` hands a designer; the second is
 * written by hand to reach every contract field the export does not use yet.
 */

import type {
  FigmaPageDocument,
  FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'
import {
  exportFigmaPage,
  type FigmaPageExportInput,
} from '@/domain/models/app/design/adapters/pages/figma-pages-export'
import type { FakeVariableSeed } from './fake-figma'

const HASH = 'a'.repeat(64)

/** The variables the bundle's Figma token files define, as Figma's Variables import creates them. */
export const SPACING_VARIABLES: readonly FakeVariableSeed[] = [
  { name: 'spacing/0', value: 0 },
  { name: 'spacing/2', value: 8 },
  { name: 'spacing/3', value: 12 },
  { name: 'spacing/4', value: 16 },
  { name: 'spacing/6', value: 24 },
  { name: 'spacing/8', value: 32 },
]

const ROW: PageDesignTreeNode = {
  id: 'home:/components/0',
  key: 'row',
  type: 'flex',
  layout: {
    direction: { value: 'row' },
    gap: { value: '1rem', token: 'spacing.4' },
    padding: { value: '1.5rem', token: 'spacing.6' },
    align: { value: 'center' },
  },
  responsive: { md: { gap: { value: '2rem', token: 'spacing.8' } } },
  children: [
    {
      id: 'home:/components/0/children/0',
      key: 'kpi',
      type: 'card',
      locked: 'template',
      children: [],
    },
    {
      id: 'home:/components/0/children/1',
      type: 'button',
      variant: 'outline',
      size: 'sm',
      content: 'Export',
      children: [],
    },
  ],
}

const INTRO: PageDesignTreeNode = {
  id: 'home:/components/1',
  type: 'text',
  content: 'Every ticket.',
  children: [],
}

const PANEL: PageDesignTreeNode = {
  id: 'home:/components/2',
  type: 'section',
  locked: 'template',
  children: [{ id: 'home:/components/2/children/0', type: 'button', content: 'Go', children: [] }],
}

const GRID: PageDesignTreeNode = {
  id: 'home:/components/3',
  type: 'data-table',
  locked: 'island',
  children: [],
}

const NODES = [ROW, INTRO, PANEL, GRID]
const flat = (nodes: readonly PageDesignTreeNode[]): readonly PageDesignTreeNode[] =>
  nodes.flatMap((node) => [node, ...flat(node.children)])

/** Which template each placement draws, and its variables. */
const PLACEMENTS: Readonly<
  Record<string, { readonly name: string; readonly variables: Readonly<Record<string, string>> }>
> = {
  'home:/components/0/children/0': { name: 'stat', variables: { label: 'Open' } },
  [PANEL.id]: { name: 'panel', variables: { title: 'Panel' } },
}

const INPUT: FigmaPageExportInput = {
  page: 'home',
  nodes: NODES,
  map: flat(NODES).map((node) => {
    const placement = PLACEMENTS[node.id]
    return {
      id: node.id,
      ...(node.key === undefined ? {} : { key: node.key }),
      type: node.type,
      contentHash: HASH,
      ...(placement === undefined
        ? {}
        : { provenance: { kind: 'template' as const, placement: node.id, ...placement } }),
    }
  }),
  islands: { [GRID.id]: { headers: ['Name', 'Status'], rows: [['Ada', 'Open']] } },
  templates: [
    { name: 'stat', type: 'card', children: [{ type: 'text', content: '$label' }] },
    {
      name: 'panel',
      type: 'section',
      children: [
        { type: 'heading', content: '$title' },
        { type: 'div', children: '$children' },
      ],
    },
  ],
  translations: {},
  breakpoints: { md: 768 },
  variables: new Set(SPACING_VARIABLES.map((variable) => variable.name)),
}

/** The CLI's own export of a page with a row, a text, a slotted template, a kit instance and an island. */
export const exportedDocument = (): FigmaPageDocument => exportFigmaPage(INPUT)

const text = (
  name: string,
  characters: string,
  extra: Partial<FigmaPageNode> = {}
): FigmaPageNode => ({
  name,
  nodeType: 'TEXT',
  ...extra,
  characters,
  children: [],
})

/** Every contract field the export does not write yet: unequal paddings, sizing, positioning, groups, shapes. */
export const handWrittenDocument = (): FigmaPageDocument => ({
  format: 'sovrium.figma.page',
  version: 1,
  page: 'about',
  variables: ['light.tokens.json', 'dark.tokens.json'],
  boards: [
    {
      breakpoint: 'base',
      width: 375,
      nodes: [
        {
          name: 'wrap',
          nodeType: 'FRAME',
          sovrium: { id: 'about:/components/0', type: 'flex' },
          locked: false,
          layoutMode: 'VERTICAL',
          itemSpacing: 0,
          paddingTop: 8,
          paddingRight: 12,
          paddingBottom: 8,
          paddingLeft: 12,
          primaryAxisAlignItems: 'SPACE_BETWEEN',
          counterAxisAlignItems: 'CENTER',
          width: 320,
          layoutSizingHorizontal: 'FIXED',
          boundVariables: { paddingTop: 'spacing/2' },
          componentProperties: { variant: 'ghost' },
          children: [
            text('title', 'Hello', {
              sovrium: { id: 'about:/components/0/children/0', type: 'text' },
              layoutSizingHorizontal: 'FILL',
            }),
            { name: 'divider', nodeType: 'RECTANGLE', layoutPositioning: 'ABSOLUTE', children: [] },
            {
              name: 'pair',
              nodeType: 'GROUP',
              children: [text('a', 'A'), { name: 'icon', nodeType: 'VECTOR', children: [] }],
            },
            {
              name: 'empty',
              nodeType: 'FRAME',
              sovrium: { type: 'badge' },
              children: [],
            },
          ],
        },
      ],
    },
  ],
  exported: [{ id: 'about:/components/0', contentHash: HASH }],
})
