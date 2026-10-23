/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Penpot file of the page export ([internal ref] A13): every exported page drawn
 * in one `adapters/penpot/<app>.penpot`, the file Penpot imports.
 *
 * The pages are drawn from the same layers as the Figma page documents, at the
 * base width and bound to no variable (Penpot reads its tokens from the Tokens
 * Studio adapter), and the archive is written by the bundle's own ZIP writer:
 * entries in path order, no timestamp, so two exports are the same bytes.
 */

import { buildDeflatedZip } from '@/application/use-cases/automations/action-handlers/file-zip'
import { exportPenpotFile } from '@/domain/models/app/design/adapters/pages/penpot-pages-export'
import { penpotFilePathOf } from '@/domain/models/app/design/adapters/pages/penpot-pages-format'
import { figmaPageDocumentsBoundTo } from './design-system-page-figma'
import type { DesignSystemBundleEntry } from './design-system-bundle'
import type { ProjectedPage } from './design-system-page-projection'
import type { App } from '@/domain/models/app'

const encoder = new TextEncoder()

/** The Penpot file of the projected pages, as one bundle entry with the `adapter` role. */
export const penpotEntryOf = (
  app: App,
  projected: readonly ProjectedPage[],
  media: readonly { readonly name: string; readonly bytes: Uint8Array }[] = []
): DesignSystemBundleEntry => {
  const documents = figmaPageDocumentsBoundTo(app, {}, projected)
  const entries = exportPenpotFile({
    app: app.name,
    pages: documents.map((document, index) => ({
      document,
      nodes: projected[index]?.tree.nodes ?? [],
    })),
  })
  return {
    path: penpotFilePathOf(app.name),
    mediaType: 'application/zip',
    role: 'adapter',
    bytes: buildDeflatedZip([
      ...entries.map((entry) => ({ name: entry.path, bytes: encoder.encode(entry.text) })),
      ...media,
    ]),
  }
}
