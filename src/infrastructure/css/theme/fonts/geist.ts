/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { GEIST_SANS_FONT_FILE, webFontStylesheetUrl } from './web-font-files'

/**
 * Self-hosted `Geist Variable` — the sans family shadcn/ui ships with.
 *
 * Served as a separate woff2 file, `/assets/fonts/<name>-<hash>.woff2`, whose
 * bytes are embedded in the binary by `@/infrastructure/assets/web-fonts`; the
 * rule below names it relative to the stylesheet. Sourced from
 * @fontsource-variable/geist v5.3.0 (`files/geist-latin-wght-normal.woff2`: latin subset, weight axis) —
 * already subset upstream, so no local subsetting step is required.
 *
 * shadcn/ui's base-nova preset names this family (`font-geist.json` and the
 * `font-geist-mono` registry item in `[internal ref]`);
 * the face is what makes that name paint rather than fall through to the
 * system stack.
 *
 * OFL-1.1; license text at `licenses/OFL-1.1-geist.txt`.
 *
 * ## Why it lives outside V1_TOKEN_LAYER
 *
 * `default-theme-layer.test.ts` asserts that `V1_TOKEN_LAYER` contains no
 * `@font-face` and no `.woff2`. Font faces are assembled separately by
 * `buildDefaultLayer` in `source-css.ts`, on BOTH the layer-on and the
 * `ECO_DESIGN_LAYER=off` paths — islands render from inline token fallbacks when
 * the layer is demoted, but the font must still exist for them.
 *
 * No CDN, ever (sovereignty, privacy, determinism) — see
 * `[internal ref]` (§ Self-hosted fonts).
 */
export const GEIST_FONT_FACE = `@font-face {
    font-family: 'Geist Variable';
    src: url('${webFontStylesheetUrl(GEIST_SANS_FONT_FILE)}') format('woff2');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
}`
