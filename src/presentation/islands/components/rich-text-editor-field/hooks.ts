/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function useSlashMenu({ editor, toolbar, onImageButtonClick }: UseSlashMenuArgs) {
  const [state, setState] = useState<SlashMenuState>({ visible: false, query: '' })
  const stateRef = useRef(state)
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

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !stateRef.current.visible) return
      e.preventDefault()
      e.stopPropagation()
      const { query } = stateRef.current
      const slashLen = query.length + 1
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

export function useDomInputSync({ editor, name, onChange }: UseDomInputSyncArgs): number {
  const [domLength, setDomLength] = useState(0)
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onInput = () => {
      const html = dom.innerHTML
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
