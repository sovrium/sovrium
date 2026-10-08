/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PDFFont } from '@cantoo/pdf-lib'

/** What every part of `PdfEditorLive` shares: the library, loaded on first use, and its refusals. */

export const pdfLib = () => import('@cantoo/pdf-lib')

export const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

/** An edit refused for a reason the config can act on; its message is the step's error. */
export class EditRefusal extends Error {}

/**
 * Refuse text the built-in font cannot draw, naming its first such character.
 * Helvetica covers the Windows-1252 set (Latin letters, accents, `€`, `—`);
 * CJK scripts, emoji and the like need a custom font, which is not supported yet.
 */
export const assertDrawable = (font: PDFFont, texts: readonly string[]): void => {
  const drawable = new Set(font.getCharacterSet())
  const character = texts
    .flatMap((text) => [...text])
    .find((char) => char !== '\n' && !drawable.has(char.codePointAt(0) ?? 0))
  if (character !== undefined) {
    throw new EditRefusal(
      `the text holds "${character}", a character the built-in font (Helvetica) cannot draw; a custom font is not supported yet`
    )
  }
}
