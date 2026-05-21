/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useRef } from 'react'
import { DEFAULT_TOOLBAR, filterMenuItemsByToolbar, SLASH_MENU_ITEMS } from './actions'
import { useDomInputSync, usePasteImage, useSlashMenu } from './hooks'
import { insertImageAtCursor, uploadImageToBucket } from './image-helpers'
import { SlashMenu } from './slash-menu'
import { Toolbar } from './toolbar'

const RICH_TEXT_EMPTY_DOC_LENGTH = '<p></p>'.length

interface RichTextEditorFieldProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  readonly maxLength?: number
  readonly displayLabel?: string
  readonly imageBucket?: string
}

function buildExtensions(placeholder?: string, maxLength?: number): any[] {
  return [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ...(maxLength ? [CharacterCount.configure({ limit: maxLength })] : []),
  ]
}

export function RichTextEditorField({
  name,
  value,
  onChange,
  toolbar,
  placeholder,
  maxLength,
  displayLabel,
  imageBucket,
}: RichTextEditorFieldProps) {
  const toolbarItems = toolbar ?? DEFAULT_TOOLBAR
  const bucket = imageBucket ?? 'default'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)

  const extensions = buildExtensions(placeholder, maxLength)
  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(name, ed.getHTML())
    },
  })
  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value && value !== undefined) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  const onImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { target } = e
      const file = target.files?.[0]
      target.value = ''
      if (!file || !editorRef.current) return
      const url = await uploadImageToBucket(file, bucket)
      if (url) insertImageAtCursor(editorRef.current, url)
    },
    [bucket]
  )

  const slashState = useSlashMenu({ editor, toolbar: toolbarItems, onImageButtonClick })
  usePasteImage({ editor, bucket })
  const domLength = useDomInputSync({ editor, name, onChange })

  const counter = (() => {
    if (!maxLength || !editor) return undefined
    const tiptapCount = editor.storage.characterCount?.characters?.() ?? 0
    const display = Math.max(tiptapCount, Math.max(0, domLength - RICH_TEXT_EMPTY_DOC_LENGTH))
    return (
      <div
        data-character-count
        className="text-fg-subtle border-t px-3 py-1 text-xs"
      >
        {display}/{maxLength}
      </div>
    )
  })()

  const overLimit = !!(maxLength && Math.max(0, domLength - RICH_TEXT_EMPTY_DOC_LENGTH) > maxLength)

  const isEmpty = editor ? editor.isEmpty : true
  const editorId = `rich-text-${name}-editor`
  const accessibleLabel = displayLabel ?? name
  return (
    <div data-rich-text-field={name}>
      <label
        htmlFor={editorId}
        className="block text-sm font-medium"
      >
        {accessibleLabel}
      </label>
      <div className="relative rounded border">
        <Toolbar
          editor={editor}
          items={toolbarItems}
          onImageButtonClick={onImageButtonClick}
        />
        <EditorContent
          editor={editor}
          id={editorId}
          aria-label={accessibleLabel}
          role="textbox"
          aria-multiline="true"
          className="prose prose-sm min-h-[6em] max-w-none p-3"
        />
        {placeholder && isEmpty && (
          <div
            data-rich-text-placeholder
            className="text-fg-subtle pointer-events-none absolute top-12 left-3"
          >
            {placeholder}
          </div>
        )}
        <SlashMenu
          state={slashState}
          items={filterMenuItemsByToolbar(SLASH_MENU_ITEMS, toolbarItems)}
        />
        {counter}
        {overLimit && (
          <div
            role="alert"
            data-form-error={name}
            className="text-error-fg border-t px-3 py-1 text-xs"
          >
            Content exceeds maximum of {maxLength} characters
          </div>
        )}
      </div>
      {}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFileChange}
      />
      {}
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
      />
    </div>
  )
}
