/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate every derivation of Sovrium's default design system from the ONE
 * hand-written source at {@link SOURCE_PATH}.
 *
 * ## What this replaced
 *
 * The default used to live in three textual copies — the CSS token layer, the
 * island fallback catalogue (`TOKENS`) and the console's inherited-token
 * projection — held in agreement by a gate that compared them to EACH OTHER.
 * Three copies and three pairwise comparisons is a mirror, not a source: the
 * gate could only ever report that they had drifted apart, never which one was
 * right. Now there is one source and three derivations, and `Design Token
 * Drift` compares each derivation back to it.
 *
 * ## Outputs
 *
 * | File | What it carries |
 * |---|---|
 * | `default-design.generated.ts` | flat `--sv-*` light values, `COLOR_TO_SV_TOKEN`, role names |
 * | `default-theme-layer.generated.ts` | the CSS blocks, byte-identical to the hand-written originals |
 * | `tokens.generated.ts` | the `TOKENS` island fallback catalogue |
 * | `inherited-tokens.generated.ts` | the console's inherited-token projection |
 * | `desktop/src/tokens.generated.css` | the desktop shell's light + dark custom properties |
 *
 * The fifth output is the odd one out and says why in its own banner: it is CSS
 * rather than TypeScript, and it lands in a tree that may not import from
 * `src/`. The desktop shell is a separate program with its own bundler, so it
 * cannot reach the token modules the way the engine's own islands do — and the
 * window around an app must not be a different colour from the app inside it.
 * A generated file is how the two stay one design without one importing the
 * other.
 *
 * The four hand-written modules survive as thin re-export shims that keep their
 * own JSDoc — the prose explaining WHY a token exists belongs beside the module
 * a reader imports, not inside a generated file nobody opens.
 *
 * ## Three things that are load-bearing, and why
 *
 * 1. **`SOURCE_PATH` is ONE constant.** Jalon 6.1 flipped it to
 *    `src/admin/config/design.ts` and deleted the temporary source in `src/`.
 *    Keeping the read behind a single name is what made that a one-line change
 *    rather than a second source of truth — do not inline the path.
 * 2. **The emitted CSS keeps its spellings.** `V1_ROOT_LIGHT`, `V1_ROOT_DARK`,
 *    `ROLE_TOKEN_BRIDGE`, `V1_ROOT_DENSITY`, `V1_TOKEN_LAYER`,
 *    `NEUTRAL_FLOOR_LAYER` and friends are named by importers, by
 * `[internal ref]` and by the two theme tests. The
 *    `html:is(.dark, [data-theme='dark'])` prefix is load-bearing for
 *    SPECIFICITY (see the source's own comment on that block) and the hex
 *    neutral floor stays hex.
 * 3. **`V1_ROOT_DENSITY` stays separate from `V1_DENSITY_STEP_BLOCKS`.**
 *    Folding the `[data-density='cozy'|'roomy']` blocks into the `:root` block
 *    would make the gate compare `roomy`'s numbers against a catalogue that
 *    mirrors the `:root` default, because the value scan keeps the LAST value
 *    per name. Two consts, one layer.
 *
 * Pure script: file IO plus Prettier. No Effect.
 *
 * Run: `bun run build:default-design`
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import {
  DEFAULT_DESIGN_SOURCE,
  type BlockItem,
  type CatalogueItem,
  type OrderedScale,
  type Scale,
  type TokenBlock,
  type ValueSpec,
} from '@/admin/config/design'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * The ONE place the source is named. Jalon 6.1 repointed it here from
 * `src/domain/models/app/design/default-design.source.ts`, and that was the
 * whole flip: one constant and one import specifier, because the read was
 * behind a single name from the start.
 *
 * The source now lives in `src/admin/config/design.ts` — the reference
 * identity's own config — beside the small `DesignConfig` that app declares for
 * itself. See that file's docstring for why the two are separate exports.
 */
export const SOURCE_PATH = 'src/admin/config/design.ts'

/** Where each derivation lands. Mirrored by `ALWAYS_ON_ASSETS` in the drift gate. */
export const OUTPUT_PATHS = {
  design: 'src/domain/models/app/design/default-design.generated.ts',
  themeLayer: 'src/infrastructure/css/theme/default-theme-layer.generated.ts',
  tokens: 'src/presentation/design/tokens.generated.ts',
  inherited: 'src/domain/models/app/design/inherited-tokens.generated.ts',
  desktopTokens: 'desktop/src/tokens.generated.css',
} as const

const COPYRIGHT = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */`

const banner = (what: string): string => `${COPYRIGHT}

/**
 * ${what}
 *
 * AUTO-GENERATED from \`${SOURCE_PATH}\` — DO NOT EDIT.
 *
 * Regenerate: \`bun run build:default-design\`
 */`

/* ────────────────────────────── CSS emission ────────────────────────────── */

/** Render a {@link ValueSpec} into the CSS text it stands for. */
export const renderValue = (value: ValueSpec): string => {
  if (typeof value === 'string') return value
  if ('ref' in value) return `var(--sv-${value.ref})`
  const fallback =
    typeof value.fallback === 'string' ? value.fallback : `var(--sv-${value.fallback.ref})`
  const inner =
    value.legacyName === undefined ? fallback : `var(--${value.legacyName}, ${fallback})`
  return `var(--${value.authorKey}, ${inner})`
}

/** Render one block's items at the layer's four-space declaration indent. */
const renderItems = (items: readonly BlockItem[]): string =>
  items
    .map((item) => {
      if (item.kind === 'blank') return ''
      if (item.kind === 'comment') return `    ${item.text}`
      return `    ${item.property}: ${renderValue(item.value)};`
    })
    .join('\n')

/** Render a whole block, closing brace at the two-space continuation indent. */
export const renderBlock = (block: TokenBlock): string =>
  `${block.selector} {\n${renderItems(block.items)}\n  }`

/** Render a scale as `--<prefix><key>: <value>;` lines. */
const renderScale = (prefix: string, scale: Scale): string =>
  Object.entries(scale)
    .map(([key, value]) => `    --${prefix}${key}: ${value};`)
    .join('\n')

/** Render an ordered scale (see `OrderedScale` — integer-like keys reorder in a record). */
const renderOrderedScale = (prefix: string, scale: OrderedScale): string =>
  scale.map(([key, value]) => `    --${prefix}${key}: ${value};`).join('\n')

/**
 * Render the platform type ladder into Tailwind's `--text-*` namespace: one
 * size declaration per rung, each followed by its `--line-height` modifier.
 *
 * Size and leading are emitted ADJACENT rather than as two blocks, because
 * Tailwind reads the modifier as part of the same rung and a reader checking
 * one against the other should not have to scroll. Every rung of `fontSizes`
 * must have a `fontSizeLeadings` entry — an unpaired rung falls through to the
 * browser's `normal`, which is the discontinuity the leadings exist to close,
 * so it throws rather than emitting a half-declared rung.
 */
const renderTypeLadder = (sizes: Scale, leadings: Scale): string =>
  Object.entries(sizes)
    .flatMap(([key, size]) => {
      const leading = leadings[key]
      if (leading === undefined) throw new Error(`type rung \`${key}\` has no leading`)
      return [`    --text-${key}: ${size};`, `    --text-${key}--line-height: ${leading};`]
    })
    .join('\n')

const renderFamilies = (families: Readonly<Record<string, { readonly family: string }>>): string =>
  Object.entries(families)
    .map(([key, { family }]) => `    --font-${key}: ${family};`)
    .join('\n')

/** The `@source inline(...)` payload: utilities only, prose dropped. */
const renderSafelist = (items: readonly { kind: string; name?: string }[]): string =>
  items
    .filter((item): item is { kind: 'utility'; name: string } => item.kind === 'utility')
    .map((item) => item.name)
    .join(' ')

/* ──────────────────────── value resolution (for TOKENS) ─────────────────── */

const camelToKebab = (camel: string): string =>
  camel
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase()

const declsOf = (block: TokenBlock) =>
  block.items.filter((item): item is Extract<BlockItem, { kind: 'decl' }> => item.kind === 'decl')

/**
 * The LIGHT-mode `--sv-*` map: the v1 ramps, then the role bridge, then the
 * density root. Later wins, exactly as the cascade does — the bridge is the
 * role-level layer above the ramps.
 */
export const lightSvValues = (): ReadonlyMap<
  string,
  { raw: ValueSpec; islandFallback?: string }
> => {
  const out = new Map<string, { raw: ValueSpec; islandFallback?: string }>()
  for (const block of [
    DEFAULT_DESIGN_SOURCE.v1.light,
    DEFAULT_DESIGN_SOURCE.roleBridge,
    DEFAULT_DESIGN_SOURCE.density.root,
  ]) {
    for (const decl of declsOf(block)) {
      if (!decl.property.startsWith('--sv-')) continue
      out.set(decl.property.slice('--sv-'.length), {
        raw: decl.value,
        ...(decl.islandFallback === undefined ? {} : { islandFallback: decl.islandFallback }),
      })
    }
  }
  return out
}

/** Every non-colour scale flattened to its emitted `--<name>` spelling. */
export const scaleValues = (): ReadonlyMap<string, string> => {
  const { scales } = DEFAULT_DESIGN_SOURCE
  const out = new Map<string, string>()
  for (const [key, { family }] of Object.entries(scales.fontFamilies))
    out.set(`font-${key}`, family)
  const add = (prefix: string, scale: Scale) => {
    for (const [key, value] of Object.entries(scale)) out.set(`${prefix}${key}`, value)
  }
  add('text-', scales.fontSizes)
  for (const [key, value] of Object.entries(scales.fontSizeLeadings)) {
    out.set(`text-${key}--line-height`, value)
  }
  add('font-weight-', scales.fontWeights)
  add('line-height-', scales.lineHeights)
  add('letter-spacing-', scales.letterSpacings)
  for (const [key, value] of scales.spacings) out.set(`spacing-${key}`, value)
  add('radius-', scales.radii)
  add('shadow-', scales.shadows)
  add('duration-', scales.durations)
  add('ease-', scales.easings)
  return out
}

/**
 * Resolve a value spec down to the literal it computes to in light mode.
 *
 * A ROLE spec resolves through its FALLBACK, never through its author key: the
 * author key is an override hook that is undefined by construction in the
 * zero-config default, which is exactly the value an island has to inline.
 */
export const resolveLight = (
  spec: ValueSpec,
  light: ReadonlyMap<string, { raw: ValueSpec }>,
  depth = 0
): string => {
  if (depth > 12) throw new Error(`token reference cycle at depth ${depth}`)
  if (typeof spec === 'string') return spec
  if ('ref' in spec) {
    const next = light.get(spec.ref)
    if (next === undefined) throw new Error(`--sv-${spec.ref} is referenced but never declared`)
    return resolveLight(next.raw, light, depth + 1)
  }
  return resolveLight(spec.fallback, light, depth + 1)
}

/** The island fallback catalogue, keyed by its camelCase `TOKENS` name. */
export const tokenCatalogueValues = (): ReadonlyMap<string, string> => {
  const light = lightSvValues()
  const scales = scaleValues()
  const out = new Map<string, string>()
  for (const item of DEFAULT_DESIGN_SOURCE.tokenCatalogue) {
    if (item.kind !== 'token') continue
    const kebab = camelToKebab(item.key)
    const sv = light.get(kebab)
    if (sv !== undefined) {
      out.set(item.key, sv.islandFallback ?? resolveLight(sv.raw, light))
      continue
    }
    const scale = scales.get(kebab)
    if (scale === undefined) {
      throw new Error(
        `token catalogue key \`${item.key}\` (--sv-${kebab} / --${kebab}) has no counterpart in ` +
          `the source. Either declare it in a block or a scale, or drop the catalogue entry — ` +
          `a catalogue key with no source is exactly the mirror this generator exists to delete.`
      )
    }
    out.set(item.key, scale)
  }
  return out
}

/* ──────────────────────────── file: theme layer ─────────────────────────── */

/**
 * A TypeScript string literal for `value`.
 *
 * `JSON.stringify` rather than a hand-rolled quote swap: it escapes the
 * backslash too, and a partial escape is exactly the `js/incomplete-sanitization`
 * shape `sovrium/no-partial-escape` refuses. Prettier normalises the quotes
 * afterwards, so the double-quoted form costs nothing.
 */
const tsString = (value: string): string => JSON.stringify(value)

const themeLayerFile = (): string => {
  const s = DEFAULT_DESIGN_SOURCE
  const colorSafelist = renderSafelist(s.safelist.colorUtilities)
  const fontSafelist = renderSafelist(s.safelist.fontUtilities)

  const nonColor = [
    '@theme {',
    '    /* ---------- Typography ---------- */',
    renderFamilies(s.scales.fontFamilies),
    '',
    renderTypeLadder(s.scales.fontSizes, s.scales.fontSizeLeadings),
    '',
    renderScale('font-weight-', s.scales.fontWeights),
    '',
    renderScale('line-height-', s.scales.lineHeights),
    '',
    renderScale('letter-spacing-', s.scales.letterSpacings),
    '',
    '    /* ---------- Spacing ---------- */',
    renderOrderedScale('spacing-', s.scales.spacings),
    '',
    '    /* ---------- Radii ---------- */',
    renderScale('radius-', s.scales.radii),
    '',
    '    /* ---------- Shadows ---------- */',
    renderScale('shadow-', s.scales.shadows),
    '',
    '    /* ---------- Motion ---------- */',
    renderScale('duration-', s.scales.durations),
    '',
    renderScale('ease-', s.scales.easings),
    '  }',
  ].join('\n')

  const floorNonColor = [
    '@theme {',
    renderFamilies(s.neutralFloor.scales.fontFamilies),
    '',
    renderTypeLadder(s.neutralFloor.scales.fontSizes, s.neutralFloor.scales.fontSizeLeadings),
    '',
    renderScale('font-weight-', s.neutralFloor.scales.fontWeights),
    '',
    renderScale('line-height-', s.neutralFloor.scales.lineHeights),
    '',
    renderScale('radius-', s.neutralFloor.scales.radii),
    '',
    renderScale('shadow-', s.neutralFloor.scales.shadows),
    '  }',
  ].join('\n')

  const stepBlocks = s.density.steps.map(renderBlock).join('\n\n  ')

  return `${banner('The default CSS token layer — every block Sovrium emits for an app that declares no design.')}

const CANONICAL_COLOR_UTILITIES = ${tsString(colorSafelist)}

const CANONICAL_FONT_UTILITIES = ${tsString(fontSafelist)}

export const V1_THEME_COLOR_REGISTRATIONS = \`${renderBlock(s.colorRegistrations)}\`

const V1_THEME_NONCOLOR_REGISTRATIONS = \`${nonColor}\`

export const V1_ROOT_LIGHT = \`${renderBlock(s.v1.light)}\`

export const V1_ROOT_DARK = \`${renderBlock(s.v1.dark)}\`

export const V1_ROOT_DENSITY = \`${renderBlock(s.density.root)}\`

const V1_DENSITY_STEP_BLOCKS = \`${stepBlocks}\`

export const V1_DENSITY_LAYER = \`\${V1_ROOT_DENSITY}

  \${V1_DENSITY_STEP_BLOCKS}\`

export const V1_TOKEN_LAYER = \`@source inline("\${CANONICAL_COLOR_UTILITIES} \${CANONICAL_FONT_UTILITIES}");

  \${V1_THEME_COLOR_REGISTRATIONS}

  \${V1_THEME_NONCOLOR_REGISTRATIONS}

  \${V1_ROOT_LIGHT}

  \${V1_ROOT_DARK}

  \${V1_DENSITY_LAYER}\`

export const V1_THEME_REGISTRATIONS = \`@source inline("\${CANONICAL_COLOR_UTILITIES} \${CANONICAL_FONT_UTILITIES}");

  \${V1_THEME_COLOR_REGISTRATIONS}

  \${V1_THEME_NONCOLOR_REGISTRATIONS}\`

export const ROLE_TOKEN_BRIDGE = \`${renderBlock(s.roleBridge)}\`

export const NEUTRAL_FLOOR_ROOT_LIGHT = \`${renderBlock(s.neutralFloor.light)}\`

export const NEUTRAL_FLOOR_ROOT_DARK = \`${renderBlock(s.neutralFloor.dark)}\`

const NEUTRAL_FLOOR_NONCOLOR = \`${floorNonColor}\`

export const NEUTRAL_FLOOR_LAYER = \`@source inline("\${CANONICAL_COLOR_UTILITIES} \${CANONICAL_FONT_UTILITIES}");

  \${V1_THEME_COLOR_REGISTRATIONS}

  \${NEUTRAL_FLOOR_NONCOLOR}

  \${NEUTRAL_FLOOR_ROOT_LIGHT}

  \${NEUTRAL_FLOOR_ROOT_DARK}

  \${V1_DENSITY_LAYER}\`
`
}

/* ────────────────────────────── file: tokens ────────────────────────────── */

const tokensFile = (): string => {
  const values = tokenCatalogueValues()
  const body = DEFAULT_DESIGN_SOURCE.tokenCatalogue
    .map((item: CatalogueItem) => {
      if (item.kind === 'blank') return ''
      if (item.kind === 'comment') return item.text
      const value = values.get(item.key)
      if (value === undefined) throw new Error(`no value resolved for token \`${item.key}\``)
      const trailing = item.trailing === undefined ? '' : ` ${item.trailing}`
      return `${item.key}: ${tsString(value)},${trailing}`
    })
    .join('\n')

  return `${banner('The island fallback catalogue — the LITERAL every prestyled island inlines beside its `--sv-*` override hook.')}

export const TOKENS = {
${body}
} as const

/** @public Design-token key vocabulary. */
export type TokenKey = keyof typeof TOKENS
`
}

/* ───────────────────────────── file: inherited ──────────────────────────── */

const record = (entries: readonly (readonly [string, string])[]): string =>
  entries.map(([key, value]) => `  ${tsString(key)}: ${tsString(value)},`).join('\n')

const inheritedFile = (): string => {
  const s = DEFAULT_DESIGN_SOURCE
  const light = lightSvValues()

  const colorEntries = s.inherited.colorRoleNames.map((role) => {
    const sv = s.legacyAliases[role] ?? role
    const entry = light.get(sv)
    if (entry === undefined)
      throw new Error(`inherited role \`${role}\` maps to unknown --sv-${sv}`)
    return [role, entry.islandFallback ?? resolveLight(entry.raw, light)] as const
  })

  const shadowEntries = Object.entries(s.scales.shadows).filter(([key]) => key !== 'none')
  const fontStacks = Object.entries(s.inherited.fontStacks)
    .map(
      ([key, stack]) => `  ${key}: [\n${stack.map((f) => `    ${tsString(f)},`).join('\n')}\n  ],`
    )
    .join('\n')

  return `${banner("The console's inherited-token projection — what an app SHIPS when it declares nothing.")}

export const INHERITED_COLOR_TOKENS: Readonly<Record<string, string>> = {
${record(colorEntries)}
}

export const INHERITED_RADIUS_TOKENS: Readonly<Record<string, string>> = {
${record(Object.entries(s.scales.radii))}
}

export const INHERITED_DURATION_TOKENS: Readonly<Record<string, string>> = {
${record(Object.entries(s.scales.durations))}
}

export const INHERITED_SHADOW_TOKENS: Readonly<Record<string, string>> = {
${record(shadowEntries)}
}

export const INHERITED_EASING_TOKENS: Readonly<Record<string, string>> = {
${record(Object.entries(s.scales.easings))}
}

export const INHERITED_FONT_TOKENS: Readonly<Record<string, readonly string[]>> = {
${fontStacks}
}

export const PLATFORM_TYPE_LADDER: readonly (readonly [string, number, number])[] = [
${s.inherited.platformTypeLadder.map(([u, size, leading]) => `  [${tsString(u)}, ${size}, ${leading}],`).join('\n')}
]

export const INHERITED_SPACING_TOKENS: Readonly<Record<string, string>> = {}

export const INHERITED_BREAKPOINT_TOKENS: Readonly<Record<string, string>> = {
${record(Object.entries(s.inherited.breakpoints))}
}

export const ROLE_COLOR_PROPERTY: Readonly<Record<string, string>> = {
${record(Object.entries(s.inherited.roleColorProperty))}
}
`
}

/* ───────────────────────────── file: design ─────────────────────────────── */

const designFile = (): string => {
  const s = DEFAULT_DESIGN_SOURCE
  const light = lightSvValues()
  const flat = [...light.keys()]
    .sort()
    .map((name) => [name, resolveLight(light.get(name)!.raw, light)] as const)

  return `${banner('Flat, resolved views over the default design — the shapes other modules and gates read.')}

/**
 * Every \`--sv-*\` token and the LITERAL it computes to in light mode, with every
 * \`var()\` indirection resolved. This is the shape a gate can compare against,
 * which the CSS text never was.
 */
export const DEFAULT_SV_LIGHT_VALUES: Readonly<Record<string, string>> = {
${record(flat)}
}

/**
 * The tokens whose ISLAND fallback literal deliberately differs from what the
 * layer's own \`var()\` chain resolves to — each one an explicit
 * \`islandFallback\` in the design source.
 *
 * This is the frozen set, on the \`eslint-suppressions.json\` precedent: it is
 * what lets \`Design Token Drift\` tolerate the nineteen measured divergences
 * while failing on the twentieth. Without it a value mismatch and a declared
 * exception are indistinguishable, and the gate reports both and passes both.
 */
export const DEFAULT_ISLAND_FALLBACKS: Readonly<Record<string, string>> = {
${record(
  [...lightSvValues().entries()]
    .filter(([, v]) => v.islandFallback !== undefined)
    .map(([k, v]) => [k, v.islandFallback!] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1))
)}
}

/**
 * Every non-colour scale token and its literal, under the \`--<name>\` spelling
 * the \`@theme\` block registers. The companion to
 * {@link DEFAULT_SV_LIGHT_VALUES}: together they cover every value the island
 * catalogue mirrors, which is what lets \`Design Token Drift\` compare the WHOLE
 * catalogue instead of just its colour half.
 */
export const DEFAULT_SCALE_VALUES: Readonly<Record<string, string>> = {
${record([...scaleValues().entries()].sort(([a], [b]) => (a < b ? -1 : 1)))}
}

/**
 * The author-key -> \`--sv-*\` role map.
 *
 * \`scripts/drift/check-brand-identity-drift.ts\` AST-parses this literal for its T2
 * lock and THROWS rather than proceeding with a shrunken map, so the object
 * shape here is load-bearing — keep it a plain inline object literal.
 */
export const COLOR_TO_SV_TOKEN: Readonly<Record<string, string>> = {
${record(Object.entries(s.legacyAliases))}
}

/** The colour roles the console publishes, in order. */
export const DEFAULT_COLOR_ROLE_NAMES: readonly string[] = [
${s.inherited.colorRoleNames.map((n) => `  ${tsString(n)},`).join('\n')}
]
`
}

/* ─────────────────────────── file: desktop tokens ───────────────────────── */

/**
 * The DARK-mode `--sv-*` overrides, as raw specs.
 *
 * Only the tokens the dark block actually redeclares — 41 of them against the
 * light side's 40 plus the bridge's 45 — because a dark block that restated
 * every role would be a second source rather than an override layer. The ramps
 * themselves are mode-independent, which is what lets a dark value like
 * `{ ref: 'neutral-950' }` resolve against the light map.
 */
export const darkSvValues = (): ReadonlyMap<string, ValueSpec> => {
  const out = new Map<string, ValueSpec>()
  for (const decl of declsOf(DEFAULT_DESIGN_SOURCE.v1.dark)) {
    if (!decl.property.startsWith('--sv-')) continue
    out.set(decl.property.slice('--sv-'.length), decl.value)
  }
  return out
}

/**
 * The desktop shell's custom properties: every role token resolved to a
 * literal, in both modes, plus the mode-independent scales.
 *
 * Three decisions worth stating, because each is the kind that gets "tidied"
 * later:
 *
 * 1. **The spellings are the ENGINE's**, not a desktop namespace. Roles are
 *    `--sv-*`; scales keep the `--text-*` / `--spacing-*` / `--font-*` /
 *    `--radius-*` names Tailwind registers them under. The shell and the app it
 *    frames therefore address the same variable by the same name, which is the
 *    whole point of shipping this file.
 * 2. **Values are RESOLVED to literals**, not emitted as `var()` chains. The
 *    engine's chains exist so an operator's `app.theme` can override a rung at
 *    runtime; the shell has no such surface — its settings page is machine
 *    settings, never app config — so a chain here would only be an indirection
 *    with nothing at the other end.
 * 3. **`prefers-color-scheme`, not a class.** The engine keys dark mode off
 *    `html:is(.dark, [data-theme='dark'])` because an app's operator chooses.
 *    The shell follows the OS, because the window is chrome and chrome that
 *    disagrees with the desktop around it looks broken.
 */
const desktopTokensFile = (): string => {
  const light = lightSvValues()
  const dark = darkSvValues()
  const scales = scaleValues()

  // Resolution happens OUTSIDE the template literals below. A non-null
  // assertion inside one reads as an exclamation mark in emitted text to the
  // terminal-language scan, which cannot tell a type-level `!` from a shouted
  // sentence — and the fix it wants is the one that is better code anyway.
  const lightDecls = [...light.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, entry]) => `  --sv-${name}: ${resolveLight(entry.raw, light)};`)
    .join('\n')

  const scaleDecls = [...scales.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n')

  const darkDecls = [...dark.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, spec]) => `    --sv-${name}: ${resolveLight(spec, light)};`)
    .join('\n')

  return `/*
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 *
 * The desktop shell's design tokens — light and dark.
 *
 * AUTO-GENERATED from \`${SOURCE_PATH}\` — DO NOT EDIT.
 * Regenerate: \`bun run build:default-design\`
 *
 * Why this file exists at all: the shell is a separate program with its own
 * bundler and may not import from \`src/\`, so it cannot reach the token modules
 * the engine's own islands read. Without a generated copy the window around an
 * app would be a different colour from the app inside it, and the drift would
 * be invisible until someone looked at both at once.
 */

:root {
  color-scheme: light;

${lightDecls}

${scaleDecls}
}

/*
 * The OS decides, not the app. The engine keys dark mode off a class because an
 * operator's config chooses it per app; the shell is chrome, and chrome that
 * disagrees with the desktop around it reads as a bug.
 */
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;

${darkDecls}
  }
}
`
}

/* ──────────────────────────────── driver ────────────────────────────────── */

const write = async (
  relative: string,
  contents: string,
  parser: prettier.BuiltInParserName = 'typescript'
): Promise<void> => {
  const target = join(REPO_ROOT, relative)
  const config = await prettier.resolveConfig(target)
  const formatted = await prettier.format(contents, { ...config, parser })
  writeFileSync(target, formatted)
}

export const generateDefaultDesign = async (): Promise<readonly string[]> => {
  await write(OUTPUT_PATHS.design, designFile())
  await write(OUTPUT_PATHS.themeLayer, themeLayerFile())
  await write(OUTPUT_PATHS.tokens, tokensFile())
  await write(OUTPUT_PATHS.inherited, inheritedFile())
  await write(OUTPUT_PATHS.desktopTokens, desktopTokensFile(), 'css')
  return Object.values(OUTPUT_PATHS)
}

if (import.meta.main) {
  const written = await generateDefaultDesign()
  console.log(`Default design generated from ${SOURCE_PATH}:`)
  for (const file of written) console.log(`  ${file}`)
}
