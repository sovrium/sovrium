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
}
