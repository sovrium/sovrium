/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const COPY_SHEET_RECT = { x: '9', y: '9', width: '11', height: '11', rx: '2' } as const
export const COPY_SHEET_PATH = 'M5 15V5a2 2 0 0 1 2-2h8'

export const CHECK_PATH = 'm5 12 5 5L20 6'

export const GLYPH_SVG_ATTRS = {
  width: '14',
  height: '14',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const CODE_COPY_BUTTON_CLASSES =
  'ml-auto inline-flex cursor-pointer items-center justify-center rounded p-1'

export const CODE_COPY_STATUS_CLASSES = 'sr-only'

const CODE_COPY_GLYPHS_HTML = `<svg width="${GLYPH_SVG_ATTRS.width}" height="${GLYPH_SVG_ATTRS.height}" viewBox="${GLYPH_SVG_ATTRS.viewBox}" fill="${GLYPH_SVG_ATTRS.fill}" stroke="${GLYPH_SVG_ATTRS.stroke}" stroke-width="${GLYPH_SVG_ATTRS.strokeWidth}" stroke-linecap="${GLYPH_SVG_ATTRS.strokeLinecap}" stroke-linejoin="${GLYPH_SVG_ATTRS.strokeLinejoin}" aria-hidden="true"><g data-copy-glyph="copy"><rect x="${COPY_SHEET_RECT.x}" y="${COPY_SHEET_RECT.y}" width="${COPY_SHEET_RECT.width}" height="${COPY_SHEET_RECT.height}" rx="${COPY_SHEET_RECT.rx}"/><path d="${COPY_SHEET_PATH}"/></g><g data-copy-glyph="copied"><path d="${CHECK_PATH}"/></g></svg>`

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const renderCodeCopyControlHtml = (copyLabel: string, copiedLabel: string): string =>
  `<button type="button" aria-label="${escapeAttr(copyLabel)}" title="${escapeAttr(
    copyLabel
  )}" data-copy-code="true" data-copied-label="${escapeAttr(
    copiedLabel
  )}" class="${CODE_COPY_BUTTON_CLASSES}">${CODE_COPY_GLYPHS_HTML}</button><span role="status" aria-live="polite" data-copy-status="true" class="${CODE_COPY_STATUS_CLASSES}"></span>`
