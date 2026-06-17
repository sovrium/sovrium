/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface Substitution {
  readonly pattern: RegExp
  readonly replacement: string
}

const SUBSTITUTIONS: ReadonlyArray<Substitution> = [
  { pattern: /```[^\n]*\n([\s\S]*?)```/g, replacement: '$1' },
  { pattern: /!\[([^\]]*)\]\([^)]*\)/g, replacement: '$1' },
  { pattern: /\[([^\]]+)\]\([^)]*\)/g, replacement: '$1' },
  { pattern: /^#{1,6}[ \t]+/gm, replacement: '' },
  { pattern: /[ \t]+#+[ \t]*$/gm, replacement: '' },
  { pattern: /^[ \t]*>[ \t]?/gm, replacement: '' },
  { pattern: /^[ \t]*[-*+][ \t]+/gm, replacement: '' },
  { pattern: /^[ \t]*\d+\.[ \t]+/gm, replacement: '' },
  { pattern: /^[ \t]*([-*_])[ \t]*\1[ \t]*\1[ \t-*_]*$/gm, replacement: '' },
  { pattern: /(\*\*|__)(.*?)\1/g, replacement: '$2' },
  { pattern: /(\*|_)(.*?)\1/g, replacement: '$2' },
  { pattern: /`([^`]+)`/g, replacement: '$1' },
]

export const markdownToText = (markdown: string): string => {
  const stripped = SUBSTITUTIONS.reduce(
    (text, { pattern, replacement }) => text.replace(pattern, replacement),
    markdown
  )
  return stripped
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}
