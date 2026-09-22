/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { CodeFieldBoundary } from './parts/crud-form/code-field-boundary'
import type { ReactElement } from 'react'

/**
 * `code-editor` — the CodeMirror editor of a `code` field, addressed by a page
 * component instead of derived from a column.
 *
 * The twin of `rich-text-editor` and the same wrapper argument: it owns the
 * value and nothing else, and defers to the SAME `CodeEditorField` the crud-form
 * and the config editors mount, through the same `CodeFieldBoundary`. So a page
 * carrying both a code component and a `code` form field downloads CodeMirror
 * plus its grammars (~428 KB) once, and a page carrying neither downloads none
 * of it.
 *
 * ─── IT EDITS A VALUE; IT IS NOT A CONFIG EDITOR ───────────────────────────
 *
 * The four `schema-*-editor` types were deleted from the catalogue in wave C1
 * because their islands POSTed into the records API behind a Save button,
 * re-admitting the config-editing plane [internal ref] D3 moved to paid Cloud through a
 * door marked "design". This component edits a formula, a snippet, a JSON blob a
 * record holds — and carries no submit control at all. The value rides in a
 * hidden input under the declared `name`, and whatever form encloses the
 * component submits it.
 *
 * ─── THE HIDDEN INPUT IS THIS ISLAND'S, NOT THE FIELD'S ────────────────────
 *
 * `RichTextEditorField` renders its own hidden mirror and this one does not, so
 * the twin components differ here on purpose: the rich-text island must NOT add
 * a second input under the same name (two would break every `[name=…]` locator
 * and every `FormData` read), while the code island must add the only one.
 */

interface CodeEditorIslandProps {
  readonly className?: string
  readonly label?: string
  readonly name?: string
  readonly value?: string
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
}

export default function CodeEditorIsland({
  className,
  label,
  name,
  value,
  language,
  lineNumbers,
  readOnly,
  tabSize,
  minLines,
  maxLines,
}: CodeEditorIslandProps): ReactElement {
  const [text, setText] = useState(value ?? '')
  const handleChange = useCallback((_name: string, next: string) => setText(next), [])

  // An unrecognised grammar edits plain text rather than failing — see the
  // schema's own note on why `language` is an open string where the rich-text
  // toolbar vocabulary is closed. `CodeEditorField` defaults an absent one to
  // `javascript`; a page component that declared none means no highlighting, so
  // the absence is forwarded as an unmatchable name rather than as `undefined`.
  const grammar = language ?? 'plain-text'
  const gutter = lineNumbers !== false

  return (
    <div className={className}>
      <CodeFieldBoundary
        name={name ?? ''}
        displayLabel={label ?? name}
        value={text}
        onChange={handleChange}
        language={grammar}
        lineNumbers={gutter}
        // EITHER gutter extension creates the `.cm-gutters` column, so turning
        // line numbers off has to turn the fold gutter off with it — otherwise
        // the column and its indent stay standing with nothing in them.
        foldGutter={gutter}
        readOnly={readOnly ?? false}
        tabSize={tabSize}
        minLines={minLines}
        maxLines={maxLines}
      />
      {name !== undefined && name !== '' && (
        <input
          type="hidden"
          name={name}
          value={text}
          readOnly
        />
      )}
    </div>
  )
}
