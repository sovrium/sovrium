/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Toolbar + slash-menu action tables for the rich-text editor field.
 *
 * Pure data + a tiny filter helper. Extracted from the main editor module
 * so the data-table/Toolbar/SlashMenu/hooks files can each import only the
 * rows they need without dragging the whole editor's React surface into
 * their dependency graph.
 */

import type { Editor } from '@tiptap/react'

export interface ToolbarActionDef {
  /**
   * The button's glyph: lucide's path data on its 24-unit grid (`bold`,
   * `italic`, `strikethrough`, `heading`, `list`, `list-ordered`, `code-xml`,
   * `text-quote`, `link`, `image`, `table`, `minus`), its lines and shapes
   * written as paths.
   */
  readonly glyph: readonly string[]
  /** The toolbar group it sits in; a separator parts two groups. */
  readonly group: 0 | 1 | 2
  /** Accessible name returned by the AT (matches the test selector). */
  readonly ariaLabel: string
  /** Imperative editor command. May be undefined for buttons that delegate
   * to an external handler (e.g. `image` opens a file picker). */
  readonly action?: (editor: Editor) => void
  readonly isActive?: (editor: Editor) => boolean
}

export const TOOLBAR_ACTIONS: Record<string, ToolbarActionDef> = {
  bold: {
    glyph: ['M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'],
    group: 0,
    ariaLabel: 'Bold',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  italic: {
    glyph: ['M19 4h-9', 'M14 20H5', 'M15 4 9 20'],
    group: 0,
    ariaLabel: 'Italic',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  strike: {
    glyph: ['M16 4H9a3 3 0 0 0-2.83 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'],
    group: 0,
    ariaLabel: 'Strikethrough',
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  heading: {
    glyph: ['M6 12h12', 'M6 20V4', 'M18 20V4'],
    group: 1,
    ariaLabel: 'Heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading'),
  },
  list: {
    glyph: ['M3 5h.01', 'M3 12h.01', 'M3 19h.01', 'M8 5h13', 'M8 12h13', 'M8 19h13'],
    group: 1,
    ariaLabel: 'Bullet list',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  'ordered-list': {
    glyph: [
      'M11 5h10',
      'M11 12h10',
      'M11 19h10',
      'M4 4h1v5',
      'M4 9h2',
      'M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02',
    ],
    group: 1,
    ariaLabel: 'Ordered list',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  'code-block': {
    glyph: ['m18 16 4-4-4-4', 'm6 8-4 4 4 4', 'm14.5 4-5 16'],
    group: 1,
    ariaLabel: 'Code block',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
  },
  blockquote: {
    glyph: ['M17 5H3', 'M21 12H8', 'M21 19H8', 'M3 12v7'],
    group: 1,
    ariaLabel: 'Blockquote',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
  },
  link: {
    glyph: [
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    ],
    group: 2,
    ariaLabel: 'Link',
    action: (editor) => {
      const url = globalThis.prompt?.('URL')
      if (url) {
        editor.chain().focus().setLink({ href: url }).run()
      }
    },
    isActive: (editor) => editor.isActive('link'),
  },
  image: {
    glyph: [
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
      'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21',
    ],
    group: 2,
    ariaLabel: 'Insert image',
    // No `action` — the image button is wired by the `RichTextEditorField`
    // component itself so it can open a file picker (NOT window.prompt) and
    // upload via the bucket multipart endpoint.
  },
  table: {
    glyph: [
      'M12 3v18',
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M3 9h18',
      'M3 15h18',
    ],
    group: 2,
    ariaLabel: 'Insert table',
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    isActive: (editor) => editor.isActive('table'),
  },
  'horizontal-rule': {
    glyph: ['M5 12h14'],
    group: 2,
    ariaLabel: 'Horizontal rule',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
}

export const DEFAULT_TOOLBAR = ['bold', 'italic', 'heading', 'list', 'link', 'code-block']

export interface SlashMenuItem {
  /** Toolbar token this menu entry maps to. */
  readonly token: string
  /** User-visible label and matcher (case-insensitive substring). */
  readonly label: string
}

export const SLASH_MENU_ITEMS: readonly SlashMenuItem[] = [
  { token: 'heading', label: 'Heading' },
  { token: 'list', label: 'Bullet list' },
  { token: 'ordered-list', label: 'Ordered list' },
  { token: 'blockquote', label: 'Blockquote' },
  { token: 'code-block', label: 'Code block' },
  { token: 'horizontal-rule', label: 'Horizontal rule' },
  { token: 'image', label: 'Image' },
  { token: 'table', label: 'Table' },
]

/**
 * Filter slash-menu entries to those whose toolbar token is enabled by the
 * field's `toolbar[]` config. This is what makes `/blockquote` a no-op when
 * `blockquote` is NOT in the toolbar (asserted by [internal ref]).
 */
export function filterMenuItemsByToolbar(
  items: readonly SlashMenuItem[],
  toolbar: readonly string[]
): readonly SlashMenuItem[] {
  const enabled = new Set(toolbar)
  return items.filter((it) => enabled.has(it.token))
}
