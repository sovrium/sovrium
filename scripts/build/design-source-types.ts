/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of the default design source: the typed object
 * `generate-default-design.ts` derives its five files from.
 *
 * The object itself is assembled by `shadcn-registry-to-design-source.ts`
 * from the pinned shadcn/ui registry snapshot
 * and the Sovrium remainder
 * (`sovrium-design-remainder.ts`). Nothing here is CSS text: values are DATA,
 * and the generator derives the CSS from them.
 */

/**
 * A declaration's value, as DATA rather than CSS text.
 *
 * - a plain string is a LITERAL (`oklch(0.985 0 0)`, `#3b82f6`, `5px`)
 * - `{ ref }` points at another `--sv-*` token; the generator emits `var(--sv-<ref>)`
 * - `{ alias }` points at a shadcn/ui variable; the generator emits
 *   `var(--<alias>)`. It is how a `--color-*` registration reads the shadcn
 *   variable it names. (The `--sv-*` aliases that also used it left in P10.)
 */
export type ValueSpec = string | { readonly ref: string } | { readonly alias: string }

/** One `--prop: value;` line. */
export interface TokenDecl {
  readonly kind: 'decl'
  readonly property: string
  readonly value: ValueSpec
  /**
   * The island's inline literal, when it differs from what {@link value}
   * resolves to. See the `islandFallback` section of this file's docstring —
   * nineteen of these exist and they are frozen, not aspirational.
   */
  readonly islandFallback?: string
}

/** Prose emitted verbatim into the CSS, above the declaration it explains. */
export interface TokenComment {
  readonly kind: 'comment'
  readonly text: string
}

/** A blank line, preserved so the emitted CSS keeps its paragraphing. */
export interface TokenBlank {
  readonly kind: 'blank'
}

export type BlockItem = TokenDecl | TokenComment | TokenBlank

/** One CSS rule: a selector and its ordered items. */
export interface TokenBlock {
  readonly selector: string
  readonly items: readonly BlockItem[]
}

/** One entry of an `@source inline(...)` safelist. */
export type SafelistItem =
  | { readonly kind: 'utility'; readonly name: string }
  | { readonly kind: 'comment'; readonly text: string }

/** An ordered, commented view over the emitted token catalogue. */
export type CatalogueItem =
  | { readonly kind: 'token'; readonly key: string; readonly trailing?: string }
  | { readonly kind: 'comment'; readonly text: string }
  | { readonly kind: 'blank' }

/** A named scale with no home in `DesignSchema` (see the docstring). */
export type Scale = Readonly<Record<string, string>>

/** One rung of the density ladder. */
export type DensityStep = {
  readonly rowY: string
  readonly controlH: string
  readonly buttonH: string
  readonly gap: string
  readonly text: string
}

/**
 * A scale whose EMISSION ORDER matters and whose keys are integer-like, so a
 * record would silently reorder it. See {@link SPACINGS}.
 */
export type OrderedScale = readonly (readonly [string, string])[]

export interface DefaultDesignSource {
  readonly safelist: {
    readonly colorUtilities: readonly SafelistItem[]
    readonly fontUtilities: readonly SafelistItem[]
  }
  readonly tokenCatalogue: readonly CatalogueItem[]
  readonly colorRegistrations: TokenBlock
  readonly scales: {
    readonly fontFamilies: Readonly<Record<string, { readonly family: string }>>
    readonly fontSizes: Scale
    readonly fontSizeLeadings: Scale
    readonly fontWeights: Scale
    readonly lineHeights: Scale
    readonly letterSpacings: Scale
    readonly spacings: OrderedScale
    readonly radii: Scale
    readonly shadows: Scale
    readonly durations: Scale
    readonly easings: Scale
  }
  readonly v1: { readonly light: TokenBlock; readonly dark: TokenBlock }
  readonly roleBridge: TokenBlock
  readonly density: {
    readonly root: TokenBlock
    readonly steps: readonly TokenBlock[]
  }
  readonly neutralFloor: {
    readonly light: TokenBlock
    readonly dark: TokenBlock
    readonly scales: {
      readonly fontFamilies: Readonly<Record<string, { readonly family: string }>>
      readonly fontSizes: Scale
      readonly fontSizeLeadings: Scale
      readonly fontWeights: Scale
      readonly lineHeights: Scale
      readonly radii: Scale
      readonly shadows: Scale
    }
  }
  /**
   * The shadcn/ui variables the snapshot declares, in its order (`background`
   * … `sidebar-ring`, `radius` included). The generator emits their flat
   * light and dark views and keys the `TOKENS` catalogue's shadcn entries on
   * them.
   */
  readonly shadcnNames: readonly string[]
  /**
   * `design.colors` key → the shadcn variable it repaints (`DESIGN_COLOR_VARS`).
   * Every shadcn colour name maps to itself; a Sovrium author key with a shadcn
   * twin (`background-raised` → `card`) maps to the twin.
   */
  readonly designColorVars: Readonly<Record<string, string>>
  /**
   * `design.colors` key → Sovrium role. The generator emits the rows whose role
   * is an extension token as `COLOR_TO_SV_TOKEN`; a row whose role was retired
   * in P10 resolves to its shadcn twin through `DESIGN_COLOR_VARS` instead.
   */
  readonly legacyAliases: Readonly<Record<string, string>>
  readonly inherited: {
    readonly breakpoints: Scale
    readonly spacing: Scale
    readonly roleColorProperty: Readonly<Record<string, string>>
    readonly colorRoleNames: readonly string[]
    readonly platformTypeLadder: readonly (readonly [string, number, number])[]
    readonly fontStacks: Readonly<Record<string, readonly string[]>>
  }
}

/**
 * The Sovrium remainder's shape: the source minus the two fields only the
 * snapshot can supply (`sovrium-design-remainder.ts`).
 */
export type DesignRemainder = Omit<DefaultDesignSource, 'shadcnNames' | 'designColorVars'>
