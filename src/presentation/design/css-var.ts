/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Var-with-fallback helper for the reads no shadcn utility expresses.
 *
 * A role with a shadcn/ui twin is read through its utility (`bg-primary`,
 * `text-muted-foreground`, `rounded-lg`) and never reaches this helper. What
 * remains are two kinds of read: a Sovrium EXTENSION token base-nova does not
 * declare (`--sv-primary-hover`, `--sv-border-strong`, the status ramps), and a
 * shape or depth step read with its literal inlined (`--radius-md`,
 * `--shadow-lg`) so an island keeps its corner and its shadow when the token
 * layer is demoted (`ECO_DESIGN_LAYER=off`).
 *
 *   import { withVarFallback as v, TOKENS as T } from '@/presentation/design/css-var'
 *
 *   <button className={cn(
 *     `rounded-[${v('radius-md', T.radiusMd)}]`,
 *     'bg-primary text-primary-foreground', // a role with a shadcn twin: its utility
 *     `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`, // a Sovrium extension role
 *     'px-3 py-2'  // layout/spacing stays raw Tailwind
 *   )}/>
 *
 * {@link TOKENS} is GENERATED from the same design source the theme layer is
 * emitted from (`bun run build:default-design`), so the inlined literal and the
 * layer's value are the same value. The entries that carry an explicit
 * `islandFallback` there are recorded there rather than repaired here.
 *
 * NOTE: this module is intentionally plain TypeScript (no Effect). It is consumed
 * inside React render passes where pure synchronous helpers are appropriate.
 */

/**
 * Build a `var(--<name>,<fallback>)` expression suitable for a Tailwind
 * arbitrary-value class (`hover:bg-[var(--sv-primary-hover,oklch(0.272_0_0))]`).
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
 * Centralized OKLCH / rem / cubic-bezier token catalog — the LITERAL a
 * prestyled island inlines beside the variable it reads.
 *
 * Keys are camelCase role names; values are the LIGHT-mode defaults (the
 * `:root` cascade). The dark cascade flips the variable under `.dark`, which
 * still wins because `var(--x, light)` looks up `--x` first.
 */
export { TOKENS } from './tokens.generated'

/**
 * @public Design-token key vocabulary (`keyof typeof TOKENS`). Exported as the
 * type-safe surface for token lookups; consumed by token-driven call sites as
 * they adopt the typed key.
 */
export type { TokenKey } from './tokens.generated'
