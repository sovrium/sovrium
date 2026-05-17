/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines-per-function -- WYSIWYG editor wiring (Tiptap setup,
   image upload, paste handler, slash menu, character counter) is intentionally
   colocated; splitting the main component further would scatter the editor's
   wiring across files without clarity benefit. */

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

/**
 * Length of the empty Tiptap document HTML (`<p></p>`). Subtracted from the
 * raw `editor.view.dom.innerHTML.length` so the visible character counter
 * matches what the user typed. Must stay in sync with
 * `RICH_TEXT_EMPTY_DOC_LENGTH` in `crud-form-island.tsx`.
 */
const RICH_TEXT_EMPTY_DOC_LENGTH = '<p></p>'.length // 7

interface RichTextEditorFieldProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  readonly maxLength?: number
  /** Optional human-readable label override; falls back to `name` if not provided. */
  readonly displayLabel?: string
  /** Storage bucket name used by the image button + paste handler. */
  readonly imageBucket?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- @tiptap/core version mismatch between starter-kit (3.22.2) and root (3.22.3)
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
  // eslint-disable-next-line functional/immutable-data -- React ref pattern: refs are designed to be mutated
  editorRef.current = editor

  // Re-sync editor content when the `value` prop changes (used by the update
  // form for round-trip rehydration — APP-PAGES-CRUD-WYSIWYG-009).
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value && value !== undefined) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  // eslint-disable-next-line no-restricted-syntax -- stable identity is required; this callback is referenced by useEffect deps in useSlashMenu / usePasteImage
  const onImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // eslint-disable-next-line no-restricted-syntax -- stable identity required; passed through to a hidden <input> handler that survives re-renders
  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { target } = e
      const file = target.files?.[0]
      // Reset the input so the same file can be re-selected
      // eslint-disable-next-line functional/immutable-data -- DOM mutation: clearing the file input value is the standard pattern
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

  // The character counter renders the bigger of:
  //  - Tiptap's internal character count (covers normal user typing), and
  //  - the editor's raw DOM `innerHTML.length` (covers content smuggled in
  //    via `el.innerHTML = ...` — see `useDomInputSync` above and test 006).
  // Tiptap wraps empty content as `<p></p>` (RICH_TEXT_EMPTY_DOC_LENGTH
  // characters), so we subtract that baseline before comparing.
  const counter = (() => {
    if (!maxLength || !editor) return undefined
    const tiptapCount = editor.storage.characterCount?.characters?.() ?? 0
    const display = Math.max(tiptapCount, Math.max(0, domLength - RICH_TEXT_EMPTY_DOC_LENGTH))
    return (
      <div
        data-character-count
        className="border-t px-3 py-1 text-xs text-gray-400"
      >
        {display}/{maxLength}
      </div>
    )
  })()

  const overLimit = !!(maxLength && Math.max(0, domLength - RICH_TEXT_EMPTY_DOC_LENGTH) > maxLength)

  // The placeholder text needs to be rendered as a real text node (not just
  // a CSS pseudo-element) so that the spec's `toContainText` assertion finds
  // it. We hide it once the editor has content.
  const isEmpty = editor ? editor.isEmpty : true
  // We use a `<label>` for the visible field name (so `getByLabel(/<name>/i)`
  // resolves the same way as for plain-text fields — asserted by
  // `auto-generated-form-from-table.spec.ts` for the `notes` rich-text field),
  // and point its `htmlFor` at the contenteditable's id so a click on the
  // label moves focus into the editor (NOT into the sibling hidden input —
  // that delegation was the root cause of regression-step-8 failing earlier).
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
          // `aria-label` makes the contenteditable resolvable through
          // `page.getByLabel(/<name>/i)` (asserted by the auto-generated form
          // spec for the `notes` rich-text field). Playwright's getByLabel
          // matches any labelable element, but `contenteditable` is not
          // strictly labelable per HTML spec, so the explicit aria-label is
          // what makes the locator deterministic across browsers.
          aria-label={accessibleLabel}
          role="textbox"
          aria-multiline="true"
          className="prose prose-sm min-h-[6em] max-w-none p-3"
        />
        {placeholder && isEmpty && (
          <div
            data-rich-text-placeholder
            className="pointer-events-none absolute top-12 left-3 text-gray-400"
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
            className="border-t px-3 py-1 text-xs text-red-600"
          >
            Content exceeds maximum of {maxLength} characters
          </div>
        )}
      </div>
      {/* Hidden file input — clicking the toolbar's image button opens the
          system file picker, which the test asserts via `waitForEvent('filechooser')`. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFileChange}
      />
      {/* Hidden input mirrors the editor value for native form submissions and
          for E2E selectors that target the field by `[name="..."]`. */}
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
      />
    </div>
  )
}
