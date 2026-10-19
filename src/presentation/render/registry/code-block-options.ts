/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `code` component's drawing options — shadcn/ui's Code Block `size`,
 * `variant`, `wrap`, `startLine` and `highlightLines` — read off the component's
 * TOP LEVEL for `code-block-component.tsx`.
 */

import { CODE_BLOCK_WRAP_CLASSES } from '@/presentation/design/code-block-line-classes'
import type { CodeBlockSize, CodeBlockVariant } from './code-block-frame'
import type { CodeBlockLineOptions } from '@/presentation/render/elements/code-block-lines'

/**
 * The line options, read off the component's TOP LEVEL like every other
 * declared field — never off the open `props` bag.
 */
export function readLineOptions(
  component: Record<string, unknown>,
  language: string | undefined
): CodeBlockLineOptions {
  const { startLine, highlightLines } = component
  return {
    language,
    startLine: typeof startLine === 'number' ? startLine : 1,
    highlightLines: Array.isArray(highlightLines)
      ? highlightLines.filter((line): line is number => typeof line === 'number')
      : undefined,
    wrap: component['wrap'] === true,
  }
}

/** shadcn/ui's Code Block size and variant, off the top level; anything else is the default. */
export function readLook(component: Record<string, unknown>): {
  readonly size: CodeBlockSize
  readonly variant: CodeBlockVariant
} {
  return {
    size: component['size'] === 'sm' ? 'sm' : 'default',
    variant: component['variant'] === 'destructive' ? 'destructive' : 'default',
  }
}

/** The scrolling `<pre>`'s wrap hook and classes, the same in both branches. */
export function wrapOf(lines: CodeBlockLineOptions): {
  readonly attr: 'true' | undefined
  readonly classes: string | undefined
} {
  return lines.wrap === true
    ? { attr: 'true', classes: CODE_BLOCK_WRAP_CLASSES }
    : { attr: undefined, classes: undefined }
}
