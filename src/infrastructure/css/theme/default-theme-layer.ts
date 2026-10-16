/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Default theme layer — Sovrium's always-present CSS token layer.
 *
 * The standalone Sovrium binary cannot read files at runtime, so the default
 * design system is inlined here as bundled TypeScript string constants — the
 * V1_TOKEN_LAYER / ROLE_TOKEN_BRIDGE / NEUTRAL_FLOOR_LAYER constants below ARE
 * the source of truth. Three layers are exported and assembled by
 * `buildDefaultLayer` in `compiler.ts`:
 *
 *   - {@link V1_TOKEN_LAYER}    — canonical role tokens, ramps and non-color
 *     tokens. Registers the canonical token names in an `@theme` block (so the
 *     Tailwind engine mints `bg-background`, `text-foreground`, `bg-primary`, `bg-error-bg`,
 *     `ring-ring`, … utilities) and ships their light/dark VALUES in plain
 *     `:root` / dark-selector blocks so they switch at runtime. A minting name
 *     points at shadcn/ui's variable (`--color-background: var(--background)`)
 *     or, for a Sovrium extension role base-nova does not declare, at its
 *     `--sv-*` extension token (`--color-background-inset: var(--sv-bg-inset)`),
 *     whose value is supplied by {@link ROLE_TOKEN_BRIDGE}.
 *   - {@link ROLE_TOKEN_BRIDGE}  — `var()` fallback chains supplying every
 *     role with its default value. `var()` late-binds at use-time, so the
 *     author's `@theme` (emitted later in the pipeline) still wins.
 *
 *     Every role resolves to its default DIRECTLY: no role reads a `--color-*`
 *     key back as an intermediate rung any more. Reading a registered name
 *     back forms a custom-property CYCLE, and the six rungs that survived that
 *     rule (`--color-ring`, `--color-success` / `-warning` / `-error` /
 *     `-info`, `--color-input`) were redundant with the author bridge
 *     (`theme-generators.ts`), which sets the role var itself. They were
 *     deleted on the way to the shadcn default.
 *
 *     The roles that have a shadcn/ui counterpart are declared under shadcn's
 *     name ONLY (`--background`, `--primary`, `--border`, `--ring`,
 *     `--chart-1` …). The `--sv-*` second spellings of those roles are gone;
 *     the `--sv-*` names that remain are the Sovrium extensions of the shadcn
 *     set — the density steps and the roles base-nova does not declare
 *     (`--sv-primary-hover`, `--sv-bg-inset`, the status ramps, …).
 *   - {@link NEUTRAL_FLOOR_LAYER} — the same canonical token set as
 *     {@link V1_TOKEN_LAYER} but with neutral, unstyled grayscale / system-font
 *     values + a dark cascade, used when `theme.baseline === 'replace'` so a
 *     replaced baseline never renders unstyled.
 *
 * ## Departures from the registry snapshot
 *
 * The generated constants below hold base-nova's values exactly. One
 * departure is emitted beside them, by `buildDefaultLayer`: the sidebar's
 * `--sidebar-primary`, `--sidebar-primary-foreground` and `--sidebar-ring`
 * follow `--primary`, `--primary-foreground` and `--ring` in both schemes
 * (`generateSidebarRoleFollowers`, `theme-generators.ts`), unless the app
 * declares the sidebar role itself. base-nova's own sidebar primary is a
 * near-black in light and a stock blue in dark, which drew a sidebar's brand
 * tile in a colour the rest of the app never uses.
 *
 * ## How the Tailwind v4 wiring works (verified, not assumed)
 *
 * `@theme { --color-background: var(--background) }` does two things: it registers
 * `--color-background` (so the `bg-background` utility resolves to `background-color:
 * var(--color-background)`) AND it would normally hoist that var into `:root`. We keep
 * the actual light/dark VALUES in a separate `:root` block and a dark-selector
 * block keyed off the shadcn variables; overriding `--background` under the
 * dark selector switches the role token at runtime. `@source inline(...)`
 * safelists every canonical utility so it is emitted in BOTH the native PostCSS
 * path AND the candidate-driven native-free binary path — independent of the
 * source-tree scan in `generated-css-assets.ts`.
 *
 * ## Dark-mode selector
 *
 * The running app toggles dark mode by adding the `.dark` class to
 * `<html>` (the palette's dark-mode action does it), and the compiler declares
 * `@custom-variant dark (&:is(.dark *))`. v1's own source keys dark off
 * `[data-theme="dark"]`. To honour both, the dark cascade is emitted under
 * `:where(.dark, [data-theme='dark'])` — the `.dark` arm matches the live
 * toggle, the `[data-theme='dark']` arm matches the legacy authored convention.
 *
 * Source of truth: the shadcn/ui registry snapshot
 *, read by
 * `scripts/build/shadcn-registry-to-design-source.ts`.
 * Every constant re-exported below is GENERATED from it by
 * `bun run build:default-design` — this module is the name every importer uses
 * and the place the prose lives, not the place the values live. Semantic
 * element styles (html/body/h1/a/.humane/…) are deliberately EXCLUDED because
 * they overlap with the existing `generateBaseLayer`. The `@font-face`
 * declarations are shipped via `SELF_HOSTED_FONT_FACES` (assembled by
 * `buildDefaultLayer` in `source-css.ts`); Geist and Geist Mono are
 * self-hosted —
 * (§ Self-hosted
 * fonts) for the strategy and budget.
 */

export {
  NEUTRAL_FLOOR_LAYER,
  NEUTRAL_FLOOR_ROOT_DARK,
  NEUTRAL_FLOOR_ROOT_LIGHT,
  ROLE_TOKEN_BRIDGE,
  V1_ROOT_DARK,
  V1_ROOT_LIGHT,
  V1_THEME_COLOR_REGISTRATIONS,
  V1_THEME_REGISTRATIONS,
  V1_TOKEN_LAYER,
} from './default-theme-layer.generated'
