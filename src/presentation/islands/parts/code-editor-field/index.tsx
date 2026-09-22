/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { EditorState } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { computeCodeEditorFrameClasses } from '@/presentation/design/code-editor-default-classes'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'
import { sovriumEditorTheme, sovriumSyntaxHighlighting } from './editor-theme'
import type { CodeEditorFieldProps } from './props'
import type { Extension } from '@codemirror/state'

const LANGUAGE_MAP: Record<string, () => Extension> = {
  javascript,
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  json,
  html,
  css,
  sql,
  markdown,
  python,
  yaml,
}

/**
 * The extension list for one mount: the indent width, the grammar, the palette.
 *
 * ─── WHY `EditorState.tabSize` IS HERE AND NOT IN `basicSetup` ─────────────
 *
 * `basicSetup.tabSize` is NOT this. It pushes `indentUnit.of(' '.repeat(n))`,
 * which decides what the Tab KEY inserts; the rendered column width of a tab
 * character already present in the value comes from this facet, which
 * CodeMirror writes straight out as `tab-size` on the content element. With
 * only the former wired, a value indented with real tabs drew identically at
 * 2, at 4 and at 8 — while the option's own description promised the "width of
 * one indent level". `[internal ref]` has prescribed this
 * facet all along.
 *
 * ─── AND WHY IT IS A MODULE-LEVEL FUNCTION ────────────────────────────────
 *
 * A `readonly Extension[]` built inside the component is an array literal in
 * JSX-prop scope, which `react-perf/jsx-no-new-array-as-prop` rejects. The
 * allocation itself is unavoidable — CodeMirror wants a fresh list per mount —
 * so it moves out of the component rather than being silenced in place.
 */
const buildExtensions = (language: string, tabSize: number): Extension[] => {
  const langFactory = LANGUAGE_MAP[language]
  return [
    EditorState.tabSize.of(tabSize),
    ...(langFactory ? [langFactory()] : []),
    sovriumSyntaxHighlighting,
  ]
}

/**
 * A `code` field: a label, and CodeMirror in a Sovrium frame.
 *
 * ─── THE TWO HALVES TRAVEL TOGETHER ────────────────────────────────────────
 *
 * The surface theme goes in the `theme` prop (it REPLACES the library's own —
 * see `editor-theme.ts`); the syntax palette goes in `extensions`, because a
 * highlight style is a facet value rather than a theme. `basicSetup` pushes
 * CodeMirror's own style with `fallback: true`, so an explicitly supplied one
 * outranks it and the factory hexes never paint. Passing one without the other
 * gives a themed ground under factory syntax colours, which is the exact state
 * `editor-theme.ts` exists to prevent.
 *
 * ─── FIELD ANATOMY, AND ONE DELIBERATE DIVERGENCE ──────────────────────────
 *
 * The 12px/500 label over a 4px gap every other control has; this was a bare
 * `<label>` wrapping the editor, so the name rendered at page body size and
 * butted against the frame.
 *
 * `readOnly` deliberately does NOT dim the frame, where `variants.mjs:166`
 * renders its read-only variant in the Disabled state at half opacity. That
 * reads as a shorthand rather than a specification: a read-only code field
 * exists to be READ, and halving its contrast defeats the only thing it is
 * for. The missing caret and the absent active-line highlight
 * (`highlightActiveLine: !readOnly`) already say it cannot be edited.
 */
export function CodeEditorField({
  name,
  value,
  onChange,
  language = 'javascript',
  lineNumbers = true,
  readOnly = false,
  tabSize = 2,
  minLines,
  maxLines,
  displayLabel,
  foldGutter = true,
  indentWithTab = true,
}: CodeEditorFieldProps) {
  const extensions = buildExtensions(language, tabSize)

  const minHeight = minLines ? `${minLines * 1.5}em` : '6em'
  const maxHeight = maxLines ? `${maxLines * 1.5}em` : '400px'

  return (
    <div className={computeFormFieldClasses()}>
      <span className={computeFormFieldLabelClasses()}>{displayLabel ?? name}</span>
      <CodeMirror
        value={value}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- form-field handler; re-render triggered by CodeMirror's own value updates dominates inline-handler cost
        onChange={(val) => onChange(name, val)}
        extensions={extensions}
        readOnly={readOnly}
        // Replaces the library's built-in light theme rather than layering over
        // it — see `editor-theme.ts` for why the ground has to be a single
        // declaration and why every colour in it is a `var()`.
        theme={sovriumEditorTheme}
        // Whether Tab indents or leaves the surface. The grid's cell editor
        // needs it OFF so Tab stays the commit-and-advance gesture — see the
        // prop's own docstring.
        indentWithTab={indentWithTab}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-render config object derived from props; CodeMirror reads it on mount, not on every render
        basicSetup={{
          lineNumbers,
          tabSize,
          foldGutter,
          highlightActiveLine: !readOnly,
        }}
        minHeight={minHeight}
        maxHeight={maxHeight}
        className={computeCodeEditorFrameClasses()}
      />
    </div>
  )
}
