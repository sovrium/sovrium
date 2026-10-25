/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The keyboard focus ring of the engine's own page chrome — the Sovrium badge,
 * the dev-mode notice's pill, button and link (WCAG 2.4.7, RGAA 10.7).
 *
 * Written on each control rather than left to the base layer's
 * `a, button, [role="button"]` rule: the notice's pill is a `<summary>`, which
 * that rule never reaches, and chrome a reader meets on every page should not
 * depend on which selectors a base rule happens to list. The ring is the
 * app's own `ring` colour, offset by its background.
 */
export const CHROME_FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'
