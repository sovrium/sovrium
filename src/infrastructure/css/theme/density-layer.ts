/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DENSITY_STEPS, type Density, type DensityStep } from '@/domain/models/app/design/density'

/** The five `--sv-density-*` declarations of one step, as CSS block body text. */
const densityDeclarations = (step: DensityStep): string =>
  [
    `    --sv-density-row-y: ${step.rowY};`,
    `    --sv-density-control-h: ${step.controlH};`,
    `    --sv-density-button-h: ${step.buttonH};`,
    `    --sv-density-gap: ${step.gap};`,
    `    --sv-density-text: ${step.text};`,
  ].join('\n')

/**
 * Generate the author's density ladder as plain `:root` + `[data-density='…']`
 * blocks, overriding the platform default in {@link V1_DENSITY_LAYER}.
 *
 * ## Why plain `:root`, not `@theme`
 *
 * Same reason as `generateAuthorSvBridge` (`theme-generators.ts`): `--sv-*` is not a Tailwind
 * theme namespace. The recipes read these through the arbitrary
 * custom-property form (`py-(--sv-density-row-y)`), which resolves a bare
 * `var()`; registering them in `@theme` would mint utilities nobody asks for
 * and invite the engine to tree-shake a value that client-hydrated islands
 * read at runtime.
 *
 * ## Cascade contract
 *
 * `buildSourceCSS` appends this AFTER `buildDefaultLayer`, and both the
 * platform default and this block are `:root` (0,1,0), so the author wins on
 * ordinary "later wins" source order — the identical contract
 * `generateAuthorSvBridge` documents for the colour roles.
 *
 * ## Which step is the default
 *
 * `steps.compact` lands at `:root`. That is a deliberate choice and not the
 * only defensible one — `cozy` is the "ordinary application surface" step by
 * the schema's own description — but the platform default IS compact (the four
 * values a zero-config app renders with), so anchoring `:root` anywhere else
 * would make declaring a density ladder silently loosen every existing table
 * even when the author copied the shipped numbers verbatim. `cozy` and `roomy`
 * stay reachable through `[data-density]`.
 *
 * Which step a page runs at is decided at render, not here: every document
 * writes `data-density` on `<html>` (`resolveDensityStep`, from the page's zone
 * in `byZone`, then `density.default`, then compact). That is why all three
 * steps are emitted regardless of what the config assigns — the stylesheet
 * serves every page of the app, and each page picks its own step.
 *
 * Deliberately takes NO `selector` parameter, unlike its colour sibling. That
 * one is parameterised because `scoped-theme-layer.ts` genuinely calls it with
 * a scope selector; nothing scopes a density ladder today, and a parameter with
 * no caller is an inert surface that reads as a capability.
 *
 * @param density - the authored `design.density`.
 */
export function generateDensityLayer(density?: Density): string {
  if (!density) return ''

  // The default step at the root selector, then every step behind its
  // `[data-density]` attribute — including the default one, so switching a
  // subtree back to it is expressible rather than requiring the attribute to
  // be removed.
  const rootBlock = `:root {\n${densityDeclarations(density.steps.compact)}\n  }`
  const stepBlocks = DENSITY_STEPS.map(
    (step) => `[data-density='${step}'] {\n${densityDeclarations(density.steps[step])}\n  }`
  )

  return [rootBlock, ...stepBlocks].join('\n\n  ')
}
