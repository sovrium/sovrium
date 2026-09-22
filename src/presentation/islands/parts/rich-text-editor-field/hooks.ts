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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractImageFile, insertImageAtCursor, uploadImageToBucket } from './image-helpers'
import { applySlashToken, resolveSlashToken } from './slash-command'
import type { SlashMenuController } from './slash-menu'
import type { Editor } from '@tiptap/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

interface UseSlashMenuArgs {
  readonly editor: Editor | null
  readonly toolbar: readonly string[]
  readonly onImageButtonClick: () => void
}

/** What the reader has typed after the slash, and whether the menu is up. */
interface SlashQueryState {
  readonly visible: boolean
  readonly query: string
}

const CLOSED: SlashQueryState = { visible: false, query: '' }

/**
 * Watch the caret for a `/<query>` at the end of the current run.
 *
 * Bound to `update` AND `selectionUpdate` because both can put the caret after
 * a slash — typing one, and moving back to one already in the document.
 *
 * The functional `setState` is what lets this live outside the hook below
 * without a ref: "close only if it was open" is a question about the previous
 * state, and asking the setter is how you ask it without capturing anything.
 */
function useSlashQueryTracking(
  editor: Editor | null,
  setState: Dispatch<SetStateAction<SlashQueryState>>
): void {
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
      setState((previous) => {
        if (match) return { visible: true, query: match[1] ?? '' }
        return previous.visible ? CLOSED : previous
      })
    }
    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor, setState])
}

/**
 * Answer the open menu from the keyboard.
 *
 * Bound in the CAPTURE phase on the editor's own node so it runs before
 * ProseMirror's Enter handling, which would otherwise split the paragraph the
 * command was typed into before anything could read it.
 */
function useSlashEnterKey({
  editor,
  stateRef,
  toolbar,
  answerWith,
}: {
  readonly editor: Editor | null
  readonly stateRef: RefObject<SlashQueryState>
  readonly toolbar: readonly string[]
  readonly answerWith: (token: string | undefined) => void
}): void {
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !stateRef.current.visible) return
      e.preventDefault()
      e.stopPropagation()
      answerWith(resolveSlashToken(stateRef.current.query, toolbar))
    }
    dom.addEventListener('keydown', onKeyDown, true)
    return () => dom.removeEventListener('keydown', onKeyDown, true)
  }, [editor, stateRef, toolbar, answerWith])
}

/**
 * Slash-menu state machine.
 *
 * Tracks `/<query>` typed at the start of the current paragraph and, when the
 * reader answers it — by pressing Enter, or by pressing an entry:
 * - Clears the slash text from the document (so it doesn't end up persisted).
 * - Applies the chosen action when the toolbar enables it.
 * - Shuts the menu.
 *
 * Enter falls through to a normal Enter when the query names nothing, so the
 * cursor still advances.
 *
 * ─── ONE ANSWER PATH, TWO WAYS IN ──────────────────────────────────────────
 *
 * `answerWith` is what both use, because dropping `/<query>` from the document
 * and applying the action are one step: the first without the second eats the
 * reader's text, and the second without the first leaves the command sitting
 * inside the block it just made. The menu shipped with only the Enter half
 * bound, so every entry drew, highlighted, and did nothing at all — founder,
 * _"je clique sur code block… il n'y a rien qui se passe"_.
 *
 * `selectItem` passes the ENTRY's own token, never the typed query: `/` alone
 * prefix-matches the first row, so re-deriving the choice there would have
 * inserted a heading whichever row the reader pressed.
 */
export function useSlashMenu({
  editor,
  toolbar,
  onImageButtonClick,
}: UseSlashMenuArgs): SlashMenuController {
  const [state, setState] = useState<SlashQueryState>(CLOSED)
  // A ref so the keydown handler reads up-to-date values without re-binding.
  const stateRef = useRef(state)
  // eslint-disable-next-line functional/immutable-data -- React ref pattern: refs are designed to be mutated
  stateRef.current = state

  useSlashQueryTracking(editor, setState)

  const answerWith = useCallback(
    (token: string | undefined) => {
      if (!editor) return
      const { query } = stateRef.current
      const slashLen = query.length + 1 // +1 for the leading slash
      const from = Math.max(0, editor.state.selection.from - slashLen)
      const to = editor.state.selection.from
      editor.chain().focus().deleteRange({ from, to }).run()
      if (token !== undefined) applySlashToken(editor, token, toolbar, onImageButtonClick)
      setState(CLOSED)
    },
    [editor, toolbar, onImageButtonClick]
  )

  const selectItem = useCallback((token: string) => answerWith(token), [answerWith])

  useSlashEnterKey({ editor, stateRef, toolbar, answerWith })

  return useMemo(
    () => ({ visible: state.visible, query: state.query, selectItem }),
    [state.visible, state.query, selectItem]
  )
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
 * Asserted by [internal ref] (drag-paste image flow).
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
