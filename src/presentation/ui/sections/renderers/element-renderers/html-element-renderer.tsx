/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildAccessibilityRole, buildScrollAttributes } from '../html-element-helpers'

export interface ElementProps {
  readonly [key: string]: unknown
  readonly className?: string
  readonly 'data-component'?: string
}

export type HTMLElementConfig = {
  readonly type:
    | 'div'
    | 'span'
    | 'section'
    | 'header'
    | 'footer'
    | 'main'
    | 'article'
    | 'aside'
    | 'nav'
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly interactions?: unknown
}

export function renderHTMLElement(config: HTMLElementConfig): ReactElement {
  const { type, props, content, children, interactions } = config
  const Element = type

  const accessibilityRole = buildAccessibilityRole(type, children.length > 0, !!content, props.role)
  const scrollAttributes = buildScrollAttributes(interactions)
  const elementProps = { ...props, ...accessibilityRole, ...scrollAttributes }

  if (content?.trim().startsWith('<')) {
    return (
      <Element
        {...elementProps}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  return <Element {...elementProps}>{content || children}</Element>
}

export function renderHeading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return <HeadingTag {...props}>{content || children}</HeadingTag>
}

const TEXT_ELEMENT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label'] as const

export function renderTextElement(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  const { level } = props
  const Tag = TEXT_ELEMENT_TAGS.includes(level as (typeof TEXT_ELEMENT_TAGS)[number])
    ? (level as keyof React.JSX.IntrinsicElements)
    : 'span'

  return <Tag {...props}>{content || children}</Tag>
}
