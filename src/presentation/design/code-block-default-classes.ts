/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui card and button (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { computePartButtonClasses } from './button-variant-classes'

/**
 * The framed `code` block on shadcn/ui's anatomy — the code blocks of
 * shadcn/ui's own documentation, which have no registry component of their
 * own. Its parts are stamped `data-slot` by the renderers (the config `code`
 * component and the docs markdown fence alike):
 *
 *   - `code-block`          — the `<figure>`, on base-nova's card surface:
 *                             `bg-card`, `rounded-xl`, and a faint ring for
 *                             its edge where the older recipe drew a border.
 *   - `code-block-header`   — the `<figcaption>` bar: small muted monospace
 *                             over a bottom rule.
 *   - `code-block-filename` — the filename, or the `>_` terminal marker.
 *   - `button`              — the copy control: base-nova's ghost button at
 *                             `icon-xs`.
 *   - `code-block-content`  — the command `<pre>`; Shiki paints its ground.
 *
 * Every rule is a class: the canonical sanitizer drops `style` on the
 * highlighted path, so inline-styled chrome would be silently stripped.
 */

/** The `<figure>`: base-nova's card surface, clipping the bar to its corners. */
export const computeCodeBlockClasses = (): string =>
  'overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10'

/** The header bar holding the filename (or terminal marker) and the copy button. */
export const computeCodeBlockHeaderClasses = (): string =>
  'flex h-9 items-center gap-2 border-b px-3 font-mono text-xs text-muted-foreground'

/** The filename or terminal marker; the copy button rides at its trailing edge. */
export const computeCodeBlockFilenameClasses = (): string =>
  'flex min-w-0 flex-1 items-center gap-2'

/** The copy control: a ghost icon button pushed to the trailing edge. */
export const computeCodeBlockCopyClasses = (): string =>
  `${computePartButtonClasses({ variant: 'ghost', size: 'icon-xs' })} ms-auto cursor-pointer`

/**
 * A command's printed `output`: quieter than the command above it (muted
 * foreground on the muted ground, over a top rule), because the command is
 * what a reader runs and the output only confirms it worked.
 */
export const computeCodeBlockOutputClasses = (): string =>
  'overflow-x-auto border-t bg-muted/50 px-4 py-3 font-mono text-sm whitespace-pre-wrap text-muted-foreground'
