/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Three React hooks that wire DOM-level concerns into Tiptap's editor:
 *
 * - `useSlashMenu`     — slash-command state machine + Enter interception
 * - `useDomInputSync`  — DOM `input` fallback for content smuggled via
 *                        `el.innerHTML = …` (drives onChange + character count)
 * - `usePasteImage`    — clipboard-paste image upload via the bucket endpoint
 *
 * Each hook is memoized on its dependency tuple. Re-binding handlers on
 * every render would defeat the captured-stateRef pattern in `useSlashMenu`
 * (the keydown listener reads `stateRef.current` directly to avoid a fresh
 * binding per state change).
 */

import { useEffect, useRef, useState } from 'react'
import { extractImageFile, insertImageAtCursor, uploadImageToBucket } from './image-helpers'
import { applySlashCommand } from './slash-command'
import type { SlashMenuState } from './slash-menu'
import type { Editor } from '@tiptap/react'

interface UseSlashMenuArgs {
  readonly editor: Editor | null
  readonly toolbar: readonly string[]
  readonly onImageButtonClick: () => void
}

/**
 * Slash-menu state machine.
 *
 * Tracks `/<query>` typed at the start of the current paragraph and, on Enter:
 * - Clears the slash text from the document (so it doesn't end up persisted).
 * - Applies the matching toolbar action when the typed token is enabled.
 * - Falls through to a normal Enter when no match (so the cursor advances).
 */
export function useSlashMenu({ editor, toolbar, onImageButtonClick }: UseSlashMenuArgs) {
  const [state, setState] = useState<SlashMenuState>({ visible: false, query: '' })
  // Refs so the keydown handler reads up-to-date values without re-binding.
  const stateRef = useRef(state)
  // eslint-disable-next-line functional/immutable-data -- React ref pattern: refs are designed to be mutated
  stateRef.current = state

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      const text = editor.state.doc.textBetween(
        Math.max(0, editor.state.selection.from - 100),
        editor.state.selection.from,
        '\n',
        '\n'
      )
      // Match a slash-command at the end of the current run (no whitespace
      // after `/`); cap the query to a reasonable length so an unrelated `/`
      // mid-document doesn't open the menu indefinitely.
      const match = text.match(/(?:^|\s)\/([a-z-]{0,30})$/i)
      if (match) {
        setState({ visible: true, query: match[1] ?? '' })
      } else if (stateRef.current.visible) {
        setState({ visible: false, query: '' })
      }
    }
    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor])

  // Intercept Enter when the slash menu is open: replace the slash command
  // with the matching toolbar action's output (or no-op when no match).
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !stateRef.current.visible) return
      e.preventDefault()
      e.stopPropagation()
      const { query } = stateRef.current
      // Delete the typed `/<query>` characters before applying the action,
      // so the resulting heading/list doesn't contain them.
      const slashLen = query.length + 1 // +1 for the leading slash
      const from = Math.max(0, editor.state.selection.from - slashLen)
      const to = editor.state.selection.from
      editor.chain().focus().deleteRange({ from, to }).run()
      applySlashCommand(editor, query, toolbar, onImageButtonClick)
      setState({ visible: false, query: '' })
    }
    dom.addEventListener('keydown', onKeyDown, true)
    return () => dom.removeEventListener('keydown', onKeyDown, true)
  }, [editor, toolbar, onImageButtonClick])

  return state
}

interface UseDomInputSyncArgs {
  readonly editor: Editor | null
  readonly name: string
  readonly onChange: (name: string, value: string) => void
}

/**
 * DOM-level fallback for `input` events on the editor surface.
 *
 * Tiptap drives its own internal ProseMirror state and ignores direct DOM
 * mutations (e.g. `el.innerHTML = ...`). The WYSIWYG specs (006, 007, 009)
 * inject HTML straight into the DOM and dispatch a synthetic `input` event
 * to simulate a determined attacker who pastes raw HTML or a paste handler
 * that bypasses the toolbar.
 *
 * To make those scenarios observable through the field's `onChange`
 * (so the form submits the smuggled HTML and the server-side sanitizer can
 * scrub it), this hook listens for input events on the editor's root node
 * and forwards the current `innerHTML` whenever it diverges from what
 * Tiptap last reported. This is a best-effort path: Tiptap's own update
 * cycle remains authoritative for normal user input.
 *
 * Returns the current DOM HTML length so the character counter can track
 * smuggled content even when Tiptap's internal model is unaware of it.
 */
export function useDomInputSync({ editor, name, onChange }: UseDomInputSyncArgs): number {
  const [domLength, setDomLength] = useState(0)
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onInput = () => {
      const html = dom.innerHTML
      // Always forward the current DOM state — when Tiptap initiated the
      // change, this matches `editor.getHTML()`; when the user smuggled HTML
      // in via `innerHTML =`, this captures the raw contents.
      onChange(name, html)
      setDomLength(html.length)
    }
    dom.addEventListener('input', onInput)
    return () => dom.removeEventListener('input', onInput)
  }, [editor, name, onChange])
  return domLength
}

interface UsePasteImageArgs {
  readonly editor: Editor | null
  readonly bucket: string
}

/**
 * Wire a clipboard-paste handler on the editor's root DOM node that uploads
 * any image File found in the DataTransfer to the bucket + inserts an `<img>`
 * referencing the returned URL.
 *
 * Asserted by APP-PAGES-CRUD-WYSIWYG-005 (drag-paste image flow).
 */
export function usePasteImage({ editor, bucket }: UsePasteImageArgs) {
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onPaste = (e: ClipboardEvent) => {
      const file = extractImageFile(e.clipboardData)
      if (!file) return
      e.preventDefault()
      e.stopPropagation()
      void uploadImageToBucket(file, bucket).then((url) => {
        if (url) insertImageAtCursor(editor, url)
      })
    }
    dom.addEventListener('paste', onPaste, true)
    return () => dom.removeEventListener('paste', onPaste, true)
  }, [editor, bucket])
}
