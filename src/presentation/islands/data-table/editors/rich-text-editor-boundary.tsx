/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  TABLE_EDITOR_PROSE_WIDTH,
  computeTablePanelCaptionClasses,
  computeTableEditorPopoverClasses,
} from '@/presentation/design/table-default-classes'
import { loadRichTextCellEditor } from '../../island-registry'
import { useDeferredComponent } from '../../parts/deferred-component'
import type { CellEditorProps } from './editor-contract'
import type { ReactElement } from 'react'

/**
 * What the cell shows between the double-click and Tiptap being ready.
 *
 * It wears the open editor's own frame — same width, border and elevation — so
 * the row settles into its edit height once rather than twice, and the reader
 * sees a surface that is opening rather than a cell that has gone blank.
 * `role="status"` announces it and `aria-busy` says the control cannot take
 * input yet.
 */
const RICH_TEXT_LOADING = (
  <div
    role="status"
    aria-busy="true"
    className={`${computeTableEditorPopoverClasses()} ${TABLE_EDITOR_PROSE_WIDTH} ${computeTablePanelCaptionClasses()} top-0 left-0`}
  >
    Loading editor…
  </div>
)

/**
 * Fetches the Tiptap-bearing cell editor on first open, then mounts it once.
 *
 * Why an effect rather than `React.lazy`, and why a `<Suspense>` boundary here
 * would fail the same way, is documented once on {@link useDeferredComponent}.
 */
export function RichTextCellEditorBoundary(props: CellEditorProps): ReactElement {
  const Editor = useDeferredComponent(loadRichTextCellEditor)
  if (!Editor) return RICH_TEXT_LOADING
  return <Editor {...props} />
}
