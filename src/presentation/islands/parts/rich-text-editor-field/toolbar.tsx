/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEditorState } from '@tiptap/react'
import { Fragment, useCallback } from 'react'
import {
  computeRichTextSeparatorClasses,
  computeRichTextToolbarButtonClasses,
  computeRichTextToolbarClasses,
} from '@/presentation/design/rich-text-editor-default-classes'
import { TOOLBAR_ACTIONS, type ToolbarActionDef } from './actions'
import type { Editor } from '@tiptap/react'
import type { ReactElement } from 'react'

interface ToolbarProps {
  readonly editor: Editor | null
  readonly items: readonly string[]
  readonly onImageButtonClick: () => void
}

const TOOLBAR_CLASSES = computeRichTextToolbarClasses()
const BUTTON_CLASSES = computeRichTextToolbarButtonClasses()
const SEPARATOR_CLASSES = computeRichTextSeparatorClasses()

/** lucide's glyph for one action, drawn at the button's icon size. */
function ActionGlyph({ paths }: { readonly paths: readonly string[] }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path
          key={d}
          d={d}
        />
      ))}
    </svg>
  )
}

/**
 * The toolbar: a `block-start` addon of the input group, holding one ghost
 * toggle per action and a separator wherever the next action starts a new
 * group. The pressed set is read from the editor's state, so a mark turned on
 * at the caret shows as pressed before anything is typed.
 */
export function Toolbar({ editor, items, onImageButtonClick }: ToolbarProps) {
  const pressed = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed === null
        ? ''
        : items.map((item) => (TOOLBAR_ACTIONS[item]?.isActive?.(ed) ? 1 : 0)).join(''),
  })
  const run = useCallback(
    (item: string, def: ToolbarActionDef) => {
      if (item === 'image') onImageButtonClick()
      else if (editor) def.action?.(editor)
    },
    [editor, onImageButtonClick]
  )
  if (!editor) return undefined
  const defs = items.flatMap((item) => {
    const def = TOOLBAR_ACTIONS[item]
    return def ? [{ item, def }] : []
  })

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      data-slot="input-group-addon"
      data-align="block-start"
      className={TOOLBAR_CLASSES}
    >
      {defs.map(({ item, def }, index) => (
        <Fragment key={item}>
          {index > 0 && defs[index - 1]?.def.group !== def.group && (
            <span
              role="none"
              data-slot="separator"
              data-orientation="vertical"
              className={SEPARATOR_CLASSES}
            />
          )}
          <button
            type="button"
            // The action's own token, beside the human `aria-label`: a spec
            // asserting WHICH actions a toolbar offers addresses them by it.
            data-rte-action={item}
            data-slot="toggle"
            data-variant="ghost"
            data-size="sm"
            aria-label={def.ariaLabel}
            aria-pressed={pressed?.[items.indexOf(item)] === '1'}
            onClick={() => run(item, def)}
            className={BUTTON_CLASSES}
          >
            <ActionGlyph paths={def.glyph} />
          </button>
        </Fragment>
      ))}
    </div>
  )
}
