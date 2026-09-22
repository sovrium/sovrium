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
import { computeFormFieldLabelClasses } from '@/presentation/design/form-layout-classes'
import {
  computeRichTextBodyClasses,
  computeRichTextCounterClasses,
  computeRichTextFrameClasses,
  computeRichTextOverLimitClasses,
  computeRichTextPlaceholderClasses,
} from '@/presentation/design/rich-text-editor-default-classes'
import { DEFAULT_TOOLBAR, filterMenuItemsByToolbar, SLASH_MENU_ITEMS } from './actions'
import { useDomInputSync, usePasteImage, useSlashMenu } from './hooks'
import { insertImageAtCursor, uploadImageToBucket } from './image-helpers'
import { SlashMenu } from './slash-menu'
import { Toolbar } from './toolbar'
import type { RichTextEditorFieldProps } from './props'

/**
 * Length of the empty Tiptap document HTML (`<p></p>`). Subtracted from the
 * raw `editor.view.dom.innerHTML.length` so the visible character counter
 * matches what the user typed. Must stay in sync with
 * `RICH_TEXT_EMPTY_DOC_LENGTH` in `crud-form-island.tsx`.
 */
const RICH_TEXT_EMPTY_DOC_LENGTH = '<p></p>'.length // 7

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- @tiptap/core version mismatch between starter-kit (3.22.2) and root (3.22.3)
function buildExtensions(placeholder?: string, maxLength?: number): any[] {
  return [
    // StarterKit ships a `link` of its own, so registering the standalone
    // extension beside it made Tiptap log `Duplicate extension names found:
    // ['link']` on every single mount. The standalone one is the registration
    // that stays, because it carries the `openOnClick: false` this editor
    // needs — a link inside an editable body is something you place the caret
    // in, not something you navigate away through — so StarterKit's is
    // switched off instead. Same shape as the CodeBlock/CodeBlockLowlight
    // guidance in `[internal ref]`.
    StarterKit.configure({ link: false }),
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
  // form for round-trip rehydration — [internal ref]).
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
    // Reaching the cap is what `maxLength` refuses further keystrokes at, so
    // that is where the counter has to change tone: the refusal is silent
    // otherwise, and an editor that stops accepting input without saying why
    // reads as broken rather than as full. `>=` and not `>` — the reader is
    // stopped AT the limit, not one character past it.
    return (
      <div
        data-character-count
        className={computeRichTextCounterClasses({ atLimit: display >= maxLength })}
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
        className={computeFormFieldLabelClasses()}
      >
        {accessibleLabel}
      </label>
      <div className={computeRichTextFrameClasses({ state: overLimit ? 'invalid' : 'default' })}>
        <Toolbar
          editor={editor}
          items={toolbarItems}
          onImageButtonClick={onImageButtonClick}
        />
        {/*
          The body and its prompt share a `relative` box, and that box is the
          fix rather than a wrapper for tidiness. The frame is `flex flex-col`,
          where an absolutely positioned child's static position is the
          container's content-box corner — so a prompt anchored to the FRAME
          landed on the toolbar and painted across its buttons. Anchored to the
          body instead, it starts on the first line of text, which is where a
          prompt for text belongs.

          The slash menu stays OUTSIDE this box on purpose: it is anchored to
          the frame, which is what puts it over the editor rather than inside
          the scroll of the text it is being typed into.
        */}
        <div className="relative">
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
            // `rte` is the content stylesheet
            // (`infrastructure/css/theme/rich-text-styles.ts`), which replaced
            // Tailwind Typography here in wave R-E. Typography is a good
            // stylesheet for an article and the wrong one for a field: it pinned
            // its own palette and its own type scale, so a themed app moved
            // every surface around the editor and none of the text inside it.
            // Two of the four classes that used to sit here existed only to claw
            // individual colours back — one for the dark ground, one because a
            // bold run was painted a fixed near-black that vanished on it.
            // Emphasis is a WEIGHT now: a bold run takes the same ink as the
            // paragraph around it, so one token moves all of the body at once.
            // Do not spell a Typography variable name in this file — the CSS
            // candidate corpus harvests identifiers out of comments, so naming
            // one adds a candidate and makes the generated assets drift.
            className={computeRichTextBodyClasses()}
          />
          {placeholder && isEmpty && (
            <div
              data-rich-text-placeholder
              className={computeRichTextPlaceholderClasses()}
            >
              {placeholder}
            </div>
          )}
        </div>
        <SlashMenu
          state={slashState}
          items={filterMenuItemsByToolbar(SLASH_MENU_ITEMS, toolbarItems)}
        />
        {counter}
        {overLimit && (
          <div
            role="alert"
            data-form-error={name}
            className={computeRichTextOverLimitClasses()}
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
