/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

export function renderContent(props: ElementProps, content: string | undefined): ReactElement {
  const { body, ...rest } = props as ElementProps & { readonly body?: string }
  return <div {...rest}>{body ?? content}</div>
}

export function renderParagraph(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <p {...props}>{content || children}</p>
}

export function renderCode(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <code {...props}>{content || children}</code>
}

export function renderPre(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <pre {...props}>{content || children}</pre>
}
