/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * A bound list with no row. With `listDisplay.hideWhenEmpty` it puts nothing in
 * the page, not even its element. Otherwise it says its
 * `listDisplay.emptyMessage`, as the item-template list does; with none it
 * stays a visible, empty box. The resolver stamps both settings
 * (`_listHideWhenEmpty`, `_listEmptyMessage`) when it finds no row.
 */
export function renderEmptyBoundList(
  domProps: Record<string, unknown>,
  elementProps: Readonly<Record<string, unknown>>
): ReactElement | null {
  if (elementProps['_listHideWhenEmpty'] === true) return null
  const emptyMessage = elementProps['_listEmptyMessage']
  if (typeof emptyMessage === 'string') {
    return (
      <div {...domProps}>
        <p data-list-empty="">{emptyMessage}</p>
      </div>
    )
  }
  return (
    <ul
      {...domProps}
      style={{
        ...(domProps.style as object | undefined),
        display: 'block',
        minHeight: '1px',
      }}
    />
  )
}
