/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The plugin's one dispatcher: a UI message in, a reply out. It holds no state
 * and makes no request — the plugin talks to nothing but the Figma document
 * and its own UI: no Sovrium URL, no instance, no network, and the manifest's
 * `networkAccess` allows no domain at all.
 */

import { buildDocument, decodeDocument } from './build-board'
import { checkBoards } from './check-board'
import type { FigmaPort } from './figma-port'
import type { CodeMessage, UiMessage } from './messages'
import { documentFileName, documentText, readBoards } from './read-board'

/** The reply to one UI message; `select` answers with the layer ids to select instead. */
export type HandledMessage =
  { readonly reply: CodeMessage } | { readonly select: ReadonlySet<string> }

const failure = (error: unknown): HandledMessage => ({
  reply: { type: 'error', message: error instanceof Error ? error.message : String(error) },
})

export const handleMessage = async (
  figma: FigmaPort,
  message: UiMessage
): Promise<HandledMessage> => {
  try {
    switch (message.type) {
      case 'import': {
        const decoded = decodeDocument(message.text)
        if (!decoded.ok) return { reply: { type: 'error', message: decoded.error } }
        const built = await buildDocument(figma, decoded.document)
        return built.ok
          ? { reply: { type: 'imported', summary: built.summary } }
          : { reply: { type: 'error', message: built.error } }
      }
      case 'export': {
        const read = await readBoards(figma)
        if (read.pages.length === 0) {
          return {
            reply: {
              type: 'error',
              message: [
                'This Figma page holds no Sovrium board to export. Import a page document first.',
                ...read.warnings,
              ].join(' '),
            },
          }
        }
        return {
          reply: {
            type: 'exported',
            files: read.pages.map(({ document }) => ({
              fileName: documentFileName(document),
              text: documentText(document),
            })),
            warnings: read.warnings,
          },
        }
      }
      case 'check':
        return { reply: { type: 'checked', report: await checkBoards(figma) } }
      case 'select':
        return { select: new Set(message.layerIds) }
    }
  } catch (error) {
    return failure(error)
  }
}
