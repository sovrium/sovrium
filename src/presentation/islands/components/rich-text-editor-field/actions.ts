/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Editor } from '@tiptap/react'

export interface ToolbarActionDef {
  readonly label: string
  readonly ariaLabel: string
  readonly action?: (editor: Editor) => void
  readonly isActive?: (editor: Editor) => boolean
}

export const TOOLBAR_ACTIONS: Record<string, ToolbarActionDef> = {
  bold: {
    label: 'B',
    ariaLabel: 'Bold',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  italic: {
    label: 'I',
    ariaLabel: 'Italic',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  strike: {
    label: 'S',
    ariaLabel: 'Strikethrough',
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  heading: {
    label: 'H',
    ariaLabel: 'Heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading'),
  },
  list: {
    label: 'List',
    ariaLabel: 'Bullet list',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  'ordered-list': {
    label: '1.',
    ariaLabel: 'Ordered list',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  'code-block': {
    label: '</>',
    ariaLabel: 'Code block',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
  },
  blockquote: {
    label: '"',
    ariaLabel: 'Blockquote',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
  },
  link: {
    label: 'Link',
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
    label: 'Img',
    ariaLabel: 'Insert image',
  },
  table: {
    label: 'Tbl',
    ariaLabel: 'Insert table',
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    isActive: (editor) => editor.isActive('table'),
  },
  'horizontal-rule': {
    label: '—',
    ariaLabel: 'Horizontal rule',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
}

export const DEFAULT_TOOLBAR = ['bold', 'italic', 'heading', 'list', 'link', 'code-block']

export interface SlashMenuItem {
  readonly token: string
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

export function filterMenuItemsByToolbar(
  items: readonly SlashMenuItem[],
  toolbar: readonly string[]
): readonly SlashMenuItem[] {
  const enabled = new Set(toolbar)
  return items.filter((it) => enabled.has(it.token))
}
