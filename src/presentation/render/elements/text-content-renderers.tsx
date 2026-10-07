/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ElementProps } from './html-element-renderer'

// NOTE: there is no generic `renderContent` renderer; no consumer needs one.

/**
 * Renders paragraph element
 */
export function renderParagraph(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <p {...omitInternalMarkers(props)}>{content || children}</p>
}

/**
 * Renders code element (inline code)
 */
export function renderCode(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <code {...omitInternalMarkers(props)}>{content || children}</code>
}

/**
 * Renders pre element (preformatted text block)
 */
export function renderPre(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <pre {...omitInternalMarkers(props)}>{content || children}</pre>
}

/**
 * Renders blockquote element (quoted text block; preserves children for nested quotes)
 */
export function renderBlockquote(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <blockquote {...omitInternalMarkers(props)}>{content || children}</blockquote>
}
