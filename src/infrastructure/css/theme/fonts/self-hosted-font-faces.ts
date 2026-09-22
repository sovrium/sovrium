/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { JETBRAINS_MONO_FONT_FACE } from './jetbrains-mono'
import { PLEX_SANS_FONT_FACE } from './plex-sans'

/**
 * The self-hosted `@font-face` set, assembled by `buildDefaultLayer` in
 * `../../compiler.ts`.
 *
 * Emitted on BOTH compilation paths — layer-on and `ECO_DESIGN_LAYER=off`.
 * Under layer-off, islands render from their inline `withVarFallback` token
 * literals rather than from the token layer, but they still need the font to
 * exist; a face shipped only with the layer would silently fall back to the
 * system stack.
 *
 * Emitted BEFORE the token layer so both families are registered before
 * `--font-sans` / `--font-mono` reference them.
 *
 * Kept out of `V1_TOKEN_LAYER` because `default-theme-layer.test.ts` asserts
 * that constant contains no `@font-face` and no `.woff2` — the token layer is
 * a pure token block.
 *
 * Two families only: [internal ref] amendment A2 deletes the Source Serif italic
 * grace note along with the `fg-humane` role. See
 * `[internal ref]`.
 */
export const SELF_HOSTED_FONT_FACES = `${PLEX_SANS_FONT_FACE}\n\n${JETBRAINS_MONO_FONT_FACE}`
