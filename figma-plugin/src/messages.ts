/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The messages between the plugin's two halves: the code in Figma's sandbox,
 * which has the document but no browser APIs, and the UI iframe, which has the
 * file picker and the download but no document. Plain JSON only — `Blob` and
 * `ArrayBuffer` cannot cross (Figma's creating-ui docs, read 2026-10-19).
 */

import type { BuildSummary } from './build-board'
import type { CheckReport } from './check-board'

/** UI → code. */
export type UiMessage =
  | { readonly type: 'import'; readonly fileName: string; readonly text: string }
  | { readonly type: 'export' }
  | { readonly type: 'check' }
  | { readonly type: 'select'; readonly layerIds: readonly string[] }

/** One document leaving the plugin. */
export interface ExportedFile {
  readonly fileName: string
  readonly text: string
}

/** Code → UI. */
export type CodeMessage =
  | { readonly type: 'imported'; readonly summary: BuildSummary }
  | {
      readonly type: 'exported'
      readonly files: readonly ExportedFile[]
      readonly warnings: readonly string[]
    }
  | { readonly type: 'checked'; readonly report: CheckReport }
  | { readonly type: 'error'; readonly message: string }

/** Whether a value posted to the code is one of the UI's messages. */
export const isUiMessage = (value: unknown): value is UiMessage => {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Readonly<Record<string, unknown>>
  switch (message['type']) {
    case 'import':
      return typeof message['fileName'] === 'string' && typeof message['text'] === 'string'
    case 'export':
    case 'check':
      return true
    case 'select':
      return (
        Array.isArray(message['layerIds']) &&
        message['layerIds'].every((id: unknown) => typeof id === 'string')
      )
    default:
      return false
  }
}
