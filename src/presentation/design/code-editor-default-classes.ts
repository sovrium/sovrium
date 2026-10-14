/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `code-editor` frame, drawn on shadcn/ui's anatomy (base-nova).
 *
 * CodeMirror stays; this module owns the FRAME the React tree draws around it:
 * an `input-group`, ringed while CodeMirror's content — the group's
 * `input-group-control` — has focus. What happens
 * inside the editor — ground, ink, the muted gutter, cursor, selection and the
 * syntax palette — is a CodeMirror `EditorView.theme`, in
 * `islands/parts/code-editor-field/editor-theme.ts`, because CodeMirror builds
 * that DOM itself and no class of ours reaches it.
 */

import { computeInputGroupFrameClasses } from '@/presentation/design/input-group-block-classes'

/**
 * The frame around the editor: an input group grown to the editor's height,
 * the editor filling its width, the rounded corners clipping its ground.
 */
export const computeCodeEditorFrameClasses = (): string =>
  `${computeInputGroupFrameClasses()} overflow-hidden has-[>.cm-editor]:h-auto [&>.cm-editor]:min-w-0 [&>.cm-editor]:flex-1`
