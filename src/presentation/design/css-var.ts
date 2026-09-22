/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default design tokens & helper.
 *
 * Every styled className in `src/presentation/islands/` should reference colors,
 * radii, shadows, and motion through the var-with-fallback pattern emitted by
 * {@link withVarFallback}. The OKLCH / rem / cubic-bezier LITERAL is the default
 * (bakes the Sovrium design into the island bundle); the CSS var name is the
 * override hook that `app.design.*` and `default-theme-layer.ts` can rebind.
 *
 *   import { withVarFallback as v, TOKENS as T } from '@/presentation/design/css-var'
 *
 *   <button className={cn(
 *     `rounded-[${v('radius-md', T.radiusMd)}]`,
 *     `bg-[${v('sv-primary', T.primary)}]`,
 *     `text-[${v('sv-primary-fg', T.primaryFg)}]`,
 *     `shadow-[${v('shadow-sm', T.shadowSm)}]`,
 *     'px-3 py-2'  // layout/spacing stays raw Tailwind
 *   )}/>
 *
 * {@link TOKENS} is GENERATED from
 * `apps/admin/config/design.ts` — the same source the
 * theme layer is emitted from — so a tenant who already overrides `--sv-*` sees
 * the SAME computed value either way; only the load-order story changes (the
 * island carries its own default instead of depending on the theme layer being
 * emitted). Regenerate with `bun run build:default-design`.
 *
 * Nineteen entries carry an explicit `islandFallback` in that source because the
 * inline literal and the layer's resolved value genuinely differ. They are
 * recorded there rather than repaired here — see the source's docstring.
 *
 * NOTE: this module is intentionally plain TypeScript (no Effect). It is consumed
 * inside React render passes where pure synchronous helpers are appropriate.
 */

/**
 * Build a `var(--<name>,<fallback>)` expression suitable for a Tailwind
 * arbitrary-value class (`bg-[var(--sv-primary,oklch(0.62_0.18_265))]`).
 *
 * Tailwind's arbitrary-value parser splits on whitespace, so any space inside
 * the fallback (typical for OKLCH like `oklch(0.62 0.18 265)` or multi-stop
 * shadows like `0 1px 2px rgb(...)`) is rewritten to `_`. The browser CSS
 * tokenizer unescapes `_` back into a space when resolving `var()`, so the
 * runtime value is unchanged.
 */
export const withVarFallback = (varName: string, fallback: string): string =>
  `var(--${varName},${fallback.replace(/ /g, '_')})`

/**
 * Centralized OKLCH / rem / cubic-bezier token catalog — the LITERAL every
 * prestyled island inlines beside its `--sv-*` override hook.
 *
 * Keys are camelCase role names; values are the LIGHT-mode defaults (the
 * `:root` cascade). The dark cascade flips them via `--sv-*` overrides under
 * `.dark`, which still wins because `var(--sv-X, light)` looks up `--sv-X`
 * first.
 */
export { TOKENS } from './tokens.generated'

/**
 * @public Design-token key vocabulary (`keyof typeof TOKENS`). Exported as the
 * type-safe surface for token lookups; consumed by token-driven call sites as
 * they adopt the typed key.
 */
export type { TokenKey } from './tokens.generated'
