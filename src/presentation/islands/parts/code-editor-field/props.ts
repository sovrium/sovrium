/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code editor's prop shape, kept in a module that imports nothing.
 *
 * `code-field-boundary.tsx` needs this type but must NOT pull CodeMirror into
 * the eager bundle, and that is the whole reason this file exists separately
 * from `index.tsx`. Importing the type from `index.tsx` would work only for as
 * long as the import kept its `type` keyword — dropping it is a one-character
 * edit that silently re-adds ~428 KB to every page that mounts any island.
 * A module with no runtime content cannot carry that weight no matter how it
 * is imported, so the mistake is unavailable rather than merely discouraged.
 */
export interface CodeEditorFieldProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
  /**
   * Human-readable caption above the editor. Falls back to `name`.
   *
   * The mirror of `RichTextEditorFieldProps.displayLabel`. A form field's `name`
   * doubles as a serviceable caption; a page component's does not — an author
   * who writes `label: 'Formula'` beside `name: 'formula'` means the reader to
   * see the first.
   */
  readonly displayLabel?: string
  /**
   * Draw the fold gutter. Defaults to `true` — what basicSetup already did.
   *
   * Separate from `lineNumbers` because the two are separate CodeMirror
   * extensions and EITHER creates the `.cm-gutters` column. Turning line numbers
   * off while the fold gutter stays on leaves the column and its indent standing
   * with nothing in it, which reads as a rendering defect rather than as a
   * choice. A caller that wants no gutter at all has to say so about both.
   */
  readonly foldGutter?: boolean
  /**
   * Let the Tab key indent inside the surface. Defaults to `true` — what
   * `@uiw/react-codemirror` already did, and what a form field wants.
   *
   * The grid's inline cell editor passes `false`, because there Tab is the
   * commit-and-advance gesture the editor frame owns. CodeMirror's Tab binding
   * calls `preventDefault` but does NOT stop the event propagating, so leaving
   * the default on would make one keypress indent the draft AND commit it,
   * storing a stray indent nobody typed. It is a prop rather than a fixed
   * policy because the two hosts genuinely want opposite answers.
   */
  readonly indentWithTab?: boolean
}
