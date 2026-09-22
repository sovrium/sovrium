/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for CODE-BLOCK CHROME — the header bar a
 * `code` component draws when it names a file (`codeFrame: 'file'`) or marks
 * itself as a shell session (`codeFrame: 'terminal'`), plus the second `<pre>`
 * that holds a command's printed `output`.
 *
 * ## Why these classes live in a `*-default-classes.ts` recipe
 *
 * `arbitrary-var-safelist.ts` scans ONLY `src/presentation/islands/`,
 * `src/presentation/ui/sections/renderers/element-renderers/` and
 * `src/presentation/utils/recipes/` for `*-default-classes.ts` files. A runtime
 * `v('sv-X', T.Y)` template literal written anywhere else resolves at module
 * load but is invisible to the safelist generator, so the matching CSS rule is
 * never emitted and the chrome paints transparent. Colour / border / radius go
 * through {@link withVarFallback} so `app.design.*` still wins at the cascade;
 * layout and spacing classes stay raw (they encode structure, not colour).
 *
 * ## Contract notes carried by the specs
 *
 * - The frame is a `<figure>` and is entirely SSR — a crawler, a reader with
 *   scripts blocked, and the SSR-built public search index all see the command
 * and its output.
 * - NOTHING in the frame may carry an inline `style` attribute: the canonical
 *   `sanitizeRichTextHTML` allowlist (security rule S2) keeps `class` on
 *   pre/code/span but DROPS `style`, so inline-styled chrome would be silently
 *   stripped on the highlighted path. Every rule below is therefore class-based.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// FRAME SHELL — the <figure> that groups header + command + output
// ──────────────────────────────────────────────────────────────────────────────

const FRAME_SHELL = [
  'overflow-hidden',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-lg', T.radiusLg)}]`,
].join(' ')

/**
 * Compute the className for the code-frame `<figure>`. `overflow-hidden` keeps
 * the header bar and the code surface inside the rounded corner; the single
 * border makes command + output read as ONE artifact rather than two stacked
 * blocks ([internal ref] asserts both live inside one frame).
 */
export const computeCodeFrameShellClasses = (): string => FRAME_SHELL

// ──────────────────────────────────────────────────────────────────────────────
// FRAME HEADER — the filename caption / terminal marker bar
// ──────────────────────────────────────────────────────────────────────────────

const FRAME_HEADER = [
  'flex items-center gap-2 px-4 py-2 font-mono text-sm',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the className for the frame's header bar — the row that shows either
 * the filename (`file` frame) or the terminal marker (`terminal` frame).
 *
 * Monospace at `text-sm` so the header reads as part of the code artifact rather
 * than as prose, on the subtle surface tone so it sits visually BEHIND the code
 * it labels. The header lives OUTSIDE `pre code` by construction: a filename
 * inside the code would be swept up by a select-all-and-copy and pasted into the
 * reader's editor as a stray first line.
 */
export const computeCodeFrameHeaderClasses = (): string => FRAME_HEADER

// ──────────────────────────────────────────────────────────────────────────────
// OUTPUT SURFACE — the second <pre>, holding what the command printed
// ──────────────────────────────────────────────────────────────────────────────

const OUTPUT_SURFACE = [
  'overflow-x-auto px-4 py-3 font-mono text-sm whitespace-pre-wrap',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border-t',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the className for a command's `output` `<pre>`.
 *
 * Deliberately quieter than the command above it (muted foreground on the
 * subtle surface, separated by a top border): the command is the thing a reader
 * runs, the output is only the confirmation that it worked. The two stay
 * distinguishable via `[data-code-command]` / `[data-code-output]` so the copy
 * payload can exclude the output — a clipboard polluted with printed output
 * would have the reader run `Created hello-world.yaml` as a second command
 *.
 */
export const computeCodeOutputClasses = (): string => OUTPUT_SURFACE
