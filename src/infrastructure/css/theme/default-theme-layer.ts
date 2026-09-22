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
 *     `ring-focus-ring`, … utilities) and ships their light/dark VALUES in plain
 *     `:root` / dark-selector blocks so they switch at runtime. The minting
 *     names point at an internal `--sv-*` indirection layer whose value is
 *     supplied by {@link ROLE_TOKEN_BRIDGE}.
 *   - {@link ROLE_TOKEN_BRIDGE}  — `var()` fallback chains supplying every
 *     canonical `--sv-*` role var with its default value. `var()` late-binds at
 *     use-time, so the author's `@theme` (emitted later in the pipeline) still
 *     wins.
 *
 *     MOST roles now resolve to the neutral default DIRECTLY, because reading
 *     the matching `--color-*` name back would form a custom-property CYCLE
 * once that name became a registered canonical alias — see the
 *     per-role notes in the block itself. Only six roles still read a
 *     `--color-*` key as an intermediate rung: `--sv-focus-ring`
 *     (`--color-ring`), the four `-solid` status roles (`--color-success` /
 *     `-warning` / `-error` / `-info`) and `--sv-border` (`--color-input`).
 *
 *     Of those, `ring`/`success`/`warning`/`error`/`info` are ALSO first-class
 *     `theme.colors` keys routed through `COLOR_TO_SV_TOKEN`
 *     (`theme-generators.ts`), so their rung is redundant with the author
 *     bridge. `--color-input` is the one exception: it is absent from
 *     `COLOR_TO_SV_TOKEN`, so this rung is the ONLY path by which it reaches
 *     `--sv-border` — a surviving shadcn component-layer alias. Retiring it is
 *     a per-token change that needs visual-regression baselines, so it stays.
 *   - {@link NEUTRAL_FLOOR_LAYER} — the same canonical token set as
 *     {@link V1_TOKEN_LAYER} but with neutral, unstyled grayscale / system-font
 *     values + a dark cascade, used when `theme.baseline === 'replace'` so a
 *     replaced baseline never renders unstyled.
 *
 * ## How the Tailwind v4 wiring works (verified, not assumed)
 *
 * `@theme { --color-background: var(--sv-bg) }` does two things: it registers
 * `--color-background` (so the `bg-background` utility resolves to `background-color:
 * var(--color-background)`) AND it would normally hoist that var into `:root`. We keep
 * the actual light/dark VALUES in a separate `:root` block and a dark-selector
 * block keyed off the `--sv-*` indirection layer; overriding `--sv-bg` under the
 * dark selector switches the role token at runtime. `@source inline(...)`
 * safelists every canonical utility so it is emitted in BOTH the native PostCSS
 * path AND the candidate-driven native-free binary path — independent of the
 * source-tree scan in `generated-css-assets.ts`.
 *
 * ## Dark-mode selector
 *
 * The running app toggles dark mode by adding the `.dark` class to
 * `<html>` (see `command-palette-runtime.ts`), and the compiler declares
 * `@custom-variant dark (&:is(.dark *))`. v1's own source keys dark off
 * `[data-theme="dark"]`. To honour both, the dark cascade is emitted under
 * `:where(.dark, [data-theme='dark'])` — the `.dark` arm matches the live
 * toggle, the `[data-theme='dark']` arm matches the legacy authored convention.
 *
 * Source of truth: `apps/admin/config/design.ts`.
 * Every constant re-exported below is GENERATED from it by
 * `bun run build:default-design` — this module is the name every importer uses
 * and the place the prose lives, not the place the values live. Semantic
 * element styles (html/body/h1/a/.humane/…) are deliberately EXCLUDED because
 * they overlap with the existing `generateBaseLayer`. The Source Serif 4
 * italic `@font-face` declaration is shipped via
 * `SELF_HOSTED_FONT_FACES` (assembled by `buildDefaultLayer` in
 * `compiler.ts`); Plex Sans and JetBrains Mono are self-hosted —
 * for the self-hosted font strategy
 * for the strategy and budget.
 */

export {
  NEUTRAL_FLOOR_LAYER,
  NEUTRAL_FLOOR_ROOT_DARK,
  NEUTRAL_FLOOR_ROOT_LIGHT,
  ROLE_TOKEN_BRIDGE,
  V1_DENSITY_LAYER,
  V1_ROOT_DARK,
  V1_ROOT_DENSITY,
  V1_ROOT_LIGHT,
  V1_THEME_COLOR_REGISTRATIONS,
  V1_THEME_REGISTRATIONS,
  V1_TOKEN_LAYER,
} from './default-theme-layer.generated'
