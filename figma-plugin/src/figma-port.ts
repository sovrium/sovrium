/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The part of the Figma Plugin API the plugin uses, as a structural port.
 *
 * Everything that builds, reads or checks a board is written against this
 * port, never against the global `figma`. Two consequences:
 *
 * - the unit tests run the real build/read/check code against a small fake
 *   (`fake-figma.ts`) under `bun test`, with no Figma at all;
 * - `code.ts` hands the real `figma` to these functions, so the package's own
 *   typecheck (`bun run typecheck:figma-plugin`, against
 *   `@figma/plugin-typings` at the pinned 1.142.0) proves the real API still
 *   satisfies every member below. A typings bump that renames or retypes one
 *   of them fails that typecheck instead of failing in a designer's file.
 *
 * The unions are copied from the typings (`plugin-api.d.ts`, line numbers in
 * `[internal ref]`)
 * rather than narrowed to what the page contract writes: a mutable property
 * is compared covariantly, so a narrower union here would make the real node
 * unassignable.
 */

/** `layoutMode` (typings line 7744). */
export type PortLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID'
/** `primaryAxisAlignItems` (line 7966). */
export type PortPrimaryAxisAlign =
  'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN' | 'SPACE_AROUND' | 'SPACE_EVENLY'
/** `counterAxisAlignItems` (line 8049). */
export type PortCounterAxisAlign = 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'
/** `layoutSizingHorizontal` / `layoutSizingVertical` (lines 7492–7500). */
export type PortSizing = 'FIXED' | 'HUG' | 'FILL'
/** `layoutPositioning` (line 8580). */
export type PortPositioning = 'AUTO' | 'ABSOLUTE'
/** `primaryAxisSizingMode` / `counterAxisSizingMode` (line 7781). */
export type PortAxisSizingMode = 'FIXED' | 'AUTO'

/** Any node: what `getNodeByIdAsync` answers, a document and a page included. */
export interface PortBaseNode {
  readonly id: string
  readonly type: string
  getPluginData(key: string): string
}

/** A layer as the plugin READS it: every field a layer of some type carries. */
export interface PortSceneNode extends PortBaseNode {
  readonly name: string
  readonly locked: boolean
  readonly x?: number
  readonly width?: number
  readonly children?: readonly PortSceneNode[]
  readonly layoutMode?: PortLayoutMode
  readonly itemSpacing?: number
  readonly paddingTop?: number
  readonly paddingRight?: number
  readonly paddingBottom?: number
  readonly paddingLeft?: number
  readonly primaryAxisAlignItems?: PortPrimaryAxisAlign
  readonly counterAxisAlignItems?: PortCounterAxisAlign
  readonly layoutSizingHorizontal?: PortSizing
  readonly layoutSizingVertical?: PortSizing
  readonly layoutPositioning?: PortPositioning
  readonly characters?: string
  /** An instance's component properties, by `name#id` (line 11234). */
  readonly componentProperties?: {
    readonly [property: string]: { readonly value: string | boolean }
  }
  /** The variables bound to the node's fields (line 6702); arrays for paints and text ranges. */
  readonly boundVariables?: { readonly [field: string]: unknown }
}

/** A Figma variable (line 2314 on). */
export interface PortVariable {
  readonly id: string
  readonly name: string
  readonly resolvedType: string
  readonly variableCollectionId: string
  readonly valuesByMode: { readonly [modeId: string]: unknown }
}

/** A layer the plugin CREATED and may therefore set. */
export interface PortWritable extends PortSceneNode {
  name: string
  locked: boolean
  readonly width: number
  readonly height: number
  x: number
  y: number
  setPluginData(key: string, value: string): void
  setBoundVariable(field: string, variable: PortVariable | null): void
  resize(width: number, height: number): void
}

/** A frame, a component or an instance: a layer with auto layout. */
export interface PortFrame extends PortWritable {
  readonly children: readonly PortSceneNode[]
  layoutMode: PortLayoutMode
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  primaryAxisAlignItems: PortPrimaryAxisAlign
  counterAxisAlignItems: PortCounterAxisAlign
  primaryAxisSizingMode: PortAxisSizingMode
  counterAxisSizingMode: PortAxisSizingMode
  layoutSizingHorizontal: PortSizing
  layoutSizingVertical: PortSizing
  layoutPositioning: PortPositioning
  fills: readonly unknown[] | symbol
  appendChild(child: PortSceneNode): void
}

/** A text layer. */
export interface PortText extends PortWritable {
  characters: string
  layoutSizingHorizontal: PortSizing
  layoutSizingVertical: PortSizing
  layoutPositioning: PortPositioning
}

/** A rectangle or a vector: a leaf shape. */
export interface PortShape extends PortWritable {
  layoutSizingHorizontal: PortSizing
  layoutSizingVertical: PortSizing
  layoutPositioning: PortPositioning
}

/** A group: children only, no auto layout. */
export interface PortGroup extends PortWritable {
  readonly children: readonly PortSceneNode[]
  layoutPositioning: PortPositioning
}

/** An instance of a main component. */
export interface PortInstance extends PortFrame {
  readonly type: string
}

/** A main component. */
export interface PortComponent extends PortFrame {
  addComponentProperty(propertyName: string, type: 'TEXT', defaultValue: string): string
  createInstance(): PortInstance
}

/** A page: the container of the boards. */
export interface PortPage {
  readonly children: readonly PortSceneNode[]
  selection: readonly PortSceneNode[]
  appendChild(child: PortSceneNode): void
}

/** The font a new text layer draws in, which must be loaded before `characters` is set. */
export interface PortFontName {
  readonly family: string
  readonly style: string
}

/** The plugin API, narrowed to what the plugin calls. */
export interface FigmaPort {
  readonly currentPage: PortPage
  createFrame(): PortFrame
  createText(): PortText
  createComponent(): PortComponent
  createRectangle(): PortShape
  createVector(): PortShape
  group(nodes: readonly PortBaseNode[], parent: PortBaseNode): PortGroup
  loadFontAsync(font: PortFontName): Promise<void>
  getNodeByIdAsync(id: string): Promise<PortBaseNode | null>
  readonly variables: {
    getLocalVariablesAsync(): Promise<PortVariable[]>
    getVariableByIdAsync(id: string): Promise<PortVariable | null>
    getVariableCollectionByIdAsync(id: string): Promise<{ readonly defaultModeId: string } | null>
  }
}
