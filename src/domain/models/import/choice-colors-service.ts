/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Select-option colours: a source's colour NAME to the `#RRGGBB` fill a
 * Sovrium option carries.
 *
 * A source names its option colours from a fixed palette (`redLight2`,
 * `greenBright`); a Sovrium option takes a hex fill. A name the palette does
 * not list gives no colour, so the option is written without one rather than
 * with a guessed one.
 */

import type { TableSourceTool } from './field-type-mappings'

const AIRTABLE_HUES = [
  'blue',
  'cyan',
  'teal',
  'green',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'gray',
] as const

/** Airtable's palette, one row per shade, in {@link AIRTABLE_HUES} order. */
const AIRTABLE_SHADES: Readonly<Record<string, readonly string[]>> = {
  Light2: [
    '#CFDFFF',
    '#D0F0FD',
    '#C2F5E9',
    '#D1F7C4',
    '#FFEAB6',
    '#FEE2D5',
    '#FFDCE5',
    '#FFDAF6',
    '#EDE2FE',
    '#EEEEEE',
  ],
  Light1: [
    '#9CC7FF',
    '#77D1F3',
    '#72DDC3',
    '#93E088',
    '#FFD66E',
    '#FFA981',
    '#FF9EB7',
    '#F99DE2',
    '#CDB0FF',
    '#CCCCCC',
  ],
  Bright: [
    '#2D7FF9',
    '#18BFFF',
    '#20D9D2',
    '#20C933',
    '#FCB400',
    '#FF6F2C',
    '#F82B60',
    '#FF08C2',
    '#8B46FF',
    '#666666',
  ],
  Dark1: [
    '#2750AE',
    '#0B76B7',
    '#06A09B',
    '#338A17',
    '#B87503',
    '#D74D26',
    '#BA1E45',
    '#B2158B',
    '#6B1CB0',
    '#444444',
  ],
}

const AIRTABLE: ReadonlyMap<string, string> = new Map(
  Object.entries(AIRTABLE_SHADES).flatMap(([shade, hexes]) =>
    AIRTABLE_HUES.map((hue, index) => [`${hue}${shade}`, hexes[index] ?? ''] as const)
  )
)

/** Notion's option palette, as its light theme fills a tag. */
const NOTION: ReadonlyMap<string, string> = new Map([
  ['default', '#E3E2E0'],
  ['gray', '#E3E2E0'],
  ['brown', '#EEE0DA'],
  ['orange', '#FADEC9'],
  ['yellow', '#FDECC8'],
  ['green', '#DBEDDB'],
  ['blue', '#D3E5EF'],
  ['purple', '#E8DEEE'],
  ['pink', '#F5E0E9'],
  ['red', '#FFE2DD'],
])

const PALETTES: Readonly<Partial<Record<TableSourceTool, ReadonlyMap<string, string>>>> = {
  airtable: AIRTABLE,
  notion: NOTION,
}

/** The `#RRGGBB` fill of a source colour name, or `undefined` when the palette has none. */
export const choiceColorOf = (tool: TableSourceTool, color: unknown): string | undefined =>
  typeof color === 'string' ? PALETTES[tool]?.get(color) : undefined
