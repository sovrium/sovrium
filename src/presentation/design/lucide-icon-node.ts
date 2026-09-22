/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The wire format for a Lucide icon: its GEOMETRY, not a component.
 *
 * Kept in a module that imports nothing so both halves of the icon path can
 * depend on it — the server-side resolver (`lucide-resolver.ts`) and the
 * client-side renderer (`lucide-glyph.tsx`) — without either pulling the other's
 * weight. That matters in one direction specifically: `lucide-resolver` holds a
 * namespace import of `lucide-react`, and anything an island reaches must never
 * touch it. See `lucide-glyph.tsx` for the measurement.
 */

/** One drawing primitive of an icon: an SVG tag plus its attributes. */
export type LucideIconNodeChild = readonly [string, Readonly<Record<string, string | number>>]

/**
 * A Lucide icon's geometry — exactly the `__iconNode` array each `lucide-react`
 * icon module exports, and exactly what lucide's own `Icon` consumes. Plain
 * JSON, so it survives the `data-island-props` round trip unchanged.
 */
export type LucideIconNode = readonly LucideIconNodeChild[]

/** SVG primitives Lucide's icon set is drawn from; nothing else is rendered. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
])

/**
 * Validates geometry parsed back out of the DOM.
 *
 * The value reaches the island as JSON in a `data-island-props` attribute. The
 * server wrote it, so this is not a trust boundary in the usual sense — but the
 * whole point of this design is that the geometry is DATA rather than code, and
 * data arriving from the document deserves a shape check before it becomes
 * elements. Restricting the tag to Lucide's own drawing primitives keeps a
 * malformed or tampered payload from constructing arbitrary elements, and costs
 * one `Set` lookup per primitive.
 */
export const isLucideIconNode = (value: unknown): value is LucideIconNode =>
  Array.isArray(value) &&
  value.every(
    (child) =>
      Array.isArray(child) &&
      child.length === 2 &&
      typeof child[0] === 'string' &&
      ALLOWED_TAGS.has(child[0]) &&
      typeof child[1] === 'object' &&
      child[1] !== null &&
      !Array.isArray(child[1]) &&
      Object.values(child[1] as Record<string, unknown>).every(
        (attr) => typeof attr === 'string' || typeof attr === 'number'
      )
  )
