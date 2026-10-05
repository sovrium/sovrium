/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The attributes a page's inline runtimes leave on the node they wired, so a
 * second run of the same script binds nothing twice. Each runtime reads its own
 * name from here, and the tabs island reads the whole list: it redraws the tab
 * open on arrival from a copy of the server markup taken AFTER those scripts
 * ran, so the copy carries every mark while the listeners stayed on the nodes it
 * replaced. A mark added to a runtime but missing from this list leaves that
 * control dead in the first tab panel.
 */
export const FORM_RUNTIME_MARK = 'data-form-runtime'
export const FAVORITES_READY_MARK = 'data-favorites-ready'
export const REORDERABLE_READY_MARK = 'data-reorderable-ready'
export const COMMENTS_FORM_READY_MARK = 'data-comments-form-ready'
export const TOC_SPY_READY_MARK = 'data-toc-spy-ready'
export const COPY_READY_MARK = 'data-copy-ready'

export const RUNTIME_READY_MARKS: readonly string[] = [
  FORM_RUNTIME_MARK,
  FAVORITES_READY_MARK,
  REORDERABLE_READY_MARK,
  COMMENTS_FORM_READY_MARK,
  TOC_SPY_READY_MARK,
  COPY_READY_MARK,
]
