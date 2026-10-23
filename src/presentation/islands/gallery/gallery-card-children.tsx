/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Suspense, lazy, type ReactNode } from 'react'
import { renderCardChild, type CardChildClasses } from '../kanban/card-template'
import type { TableRecord } from '../runtime/types'

/**
 * A card child gated on its record (`visibility.record`) or drawn as a button:
 * rendered by a chunk fetched only by a gallery whose cards carry one, so a
 * plain gallery pays nothing for it.
 */
const GalleryCardControl = lazy(() => import('./gallery-card-control'))

/** Does this card child need its record beyond its text? */
const isRecordControl = (child: Readonly<Record<string, unknown>>): boolean =>
  child['type'] === 'button' ||
  (child['visibility'] as { readonly record?: unknown } | undefined)?.record !== undefined

/** One card child: its text and record components drawn here, a control in its own chunk. */
export function GalleryBodyChild({
  child,
  record,
  index,
  classes,
}: {
  readonly child: Readonly<Record<string, unknown>>
  readonly record: TableRecord
  readonly index: number
  readonly classes: CardChildClasses
}): ReactNode {
  if (!isRecordControl(child)) return renderCardChild(child, record, index, classes)
  return (
    <Suspense fallback={null}>
      <GalleryCardControl
        child={child}
        record={record}
        index={index}
        classes={classes}
      />
    </Suspense>
  )
}
