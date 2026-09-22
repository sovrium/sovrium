/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for `code-editor` (wave R-E).
 *
 * This module owns the FRAME the React tree draws around CodeMirror. What
 * happens INSIDE the editor — ground, ink, gutter, cursor, selection, active
 * line, and the syntax palette — is a CodeMirror `EditorView.theme`, in
 * `islands/components/code-editor-field/editor-theme.ts`, because CodeMirror
 * builds that DOM itself and no class of ours reaches it.
 *
 * ## Home
 * `presentation/utils/recipes`, which is in `RECIPE_DIRS`
 * (`arbitrary-var-safelist.ts`) so the `v(…)` arbitrary values reach the
 * compiler's safelist. A recipe written outside those three directories emits
 * no CSS rule at all.
 *
 * ## Target
 * Canvas oracle: `variants.mjs:166` (`codeEd` and its three states),
 * `kit.mjs:104` (the specimen), `chrome.mjs:77` (the `.code` block whose
 * radius and ground the editor shares), `spec-fields.mjs:197-222` (the
 * language, gutter, indent, height and read-only option rows).
 *
 * | part    | property        | value                          |
 * |---------|-----------------|--------------------------------|
 * | frame   | border / radius | 1px border-strong · r6         |
 * | · focus | border + ring   | primary + the house ring       |
 * | · disabled | opacity      | 0.5                            |
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

/**
 * The frame around the editor.
 *
 * `border-strong` and `radius-md`, where this shipped as `border-border
 * rounded` — the light panel rule at 4px. A code editor is a CONTROL you type
 * into, so it takes the same strong edge as an input; and it is a code
 * SURFACE, so it takes the 6px the rest of the system gives one
 * (`chrome.mjs:77`). Four pixels on the light grey made it read as a quoted
 * block rather than as something editable.
 *
 * `focus-within`, not `focus`: what takes focus is CodeMirror's own
 * contenteditable inside the frame, so a ring on the frame itself never fires.
 * The editor had no focus affordance at all before R-E, which on a control
 * with no visible caret until you type is the difference between "ready" and
 * "broken".
 *
 * `overflow-hidden` keeps the editor's own ground inside the rounded corners —
 * without it CodeMirror's opaque background squares them off again.
 */
export const computeCodeEditorFrameClasses = ({
  state,
}: { readonly state?: 'default' | 'disabled' } = {}): string =>
  [
    'overflow-hidden border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `rounded-[${v('radius-md', T.radiusMd)}]`,
    state === 'disabled' ? 'opacity-50' : '',
    'focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2',
    `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    `focus-within:ring-offset-[${v('sv-bg', T.bg)}]`,
    `focus-within:border-[${v('sv-primary', T.primary)}]`,
  ]
    .filter(Boolean)
    .join(' ')
