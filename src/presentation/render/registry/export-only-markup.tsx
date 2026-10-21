/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportNodeIdOf } from '@/domain/models/app/pages/node-identity'
import type { ReactElement } from 'react'

/**
 * Whether a component is a page export's own copy of a node: only that copy
 * carries an export node id (`design-system-page-projection.ts`).
 */
export const isExportedNode = (component: unknown): boolean =>
  exportNodeIdOf(component) !== undefined

/**
 * Markup an island only holds in its props (a closed dialog's body, an
 * unopened tab panel), drawn `hidden` in a page export.
 *
 * A page export ties every node of its tree back to the element that draws
 * it, and a node it does not draw reads, on the way back from a design tool,
 * as a node the designer deleted. So the export draws that markup in the
 * document, out of sight, where its nodes keep their ids. A page served to a
 * reader draws nothing here: the island renders the markup when it opens.
 *
 * @param html - server-rendered markup (`renderToStaticMarkup` output)
 * @param exported - whether the drawing is a page export's ({@link isExportedNode})
 * @param id - the panel the markup belongs to, when it is one of several
 */
export function renderExportOnlyMarkup(
  html: string,
  exported: boolean,
  id?: string
): ReactElement | undefined {
  if (!exported || html.length === 0) return undefined
  return (
    <div
      key={id}
      hidden
      // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
