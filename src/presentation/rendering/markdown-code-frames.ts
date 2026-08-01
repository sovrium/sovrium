/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveDefaultCodeFrame } from '@/domain/utils/code-frame-defaults'
import {
  computeCodeFrameHeaderClasses,
  computeCodeFrameShellClasses,
} from '@/presentation/ui/sections/renderers/element-renderers/recipes/code-frame-default-classes'
import { renderCodeCopyControlHtml } from '@/presentation/utils/design/code-copy-glyphs'
import type { MarkdownCodeBlock } from '@/domain/services/markdown/markdown-renderer'

const COPY_LABEL = 'Copy'
const COPIED_LABEL = 'Copied'

const FENCE_RE = /<pre\b[^>]*\bsv-md-code-(\d+)\b[^>]*>[\s\S]*?<\/pre>/g

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const markCommandPre = (preHtml: string): string =>
  preHtml.replace(/^<pre\b/, '<pre data-code-command="true" data-copy-target="true"')

const renderFenceFrame = (block: MarkdownCodeBlock, preHtml: string): string => {
  const fallback = resolveDefaultCodeFrame(block.lang)
  const { title } = block
  const frame = title === undefined ? fallback.frame : 'file'
  const label = title ?? fallback.label
  const headerText = frame === 'file' ? label : `>_ ${label}`
  const headerMarker = frame === 'file' ? 'data-code-filename="true"' : 'data-code-terminal="true"'
  return [
    `<figure data-code-frame="${frame}" data-code-copy-scope="true"`,
    ` aria-label="${escapeText(label).replace(/"/g, '&quot;')}"`,
    ` class="${computeCodeFrameShellClasses()}">`,
    `<figcaption ${headerMarker} class="${computeCodeFrameHeaderClasses()}">`,
    `<span>${escapeText(headerText)}</span>`,
    renderCodeCopyControlHtml(COPY_LABEL, COPIED_LABEL),
    `</figcaption>`,
    markCommandPre(preHtml),
    `</figure>`,
  ].join('')
}

export const spliceMarkdownCodeFrames = (
  html: string,
  codeBlocks: readonly MarkdownCodeBlock[]
): string => {
  if (codeBlocks.length === 0) return html
  return html.replace(FENCE_RE, (match, indexStr: string) => {
    const block = codeBlocks[Number(indexStr)]
    if (block === undefined) return match
    return renderFenceFrame(block, match)
  })
}
