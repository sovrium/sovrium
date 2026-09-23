/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { buildAccessibilityRole, buildScrollAttributes } from './html-element-helpers'

/**
 * Common props for all rendered elements
 */
export interface ElementProps {
  readonly [key: string]: unknown
  readonly className?: string
  readonly 'data-component'?: string
}

/**
 * Configuration for renderHTMLElement
 */
export type HTMLElementConfig = {
  readonly type:
    'div' | 'span' | 'section' | 'header' | 'footer' | 'main' | 'article' | 'aside' | 'nav'
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly interactions?: unknown
}

/**
 * Renders HTML structural elements (div, span, section, and HTML5 semantic elements)
 *
 * If content starts with '<', it's treated as HTML and rendered via dangerouslySetInnerHTML.
 * Otherwise, content is rendered as plain text.
 *
 * SECURITY: use of dangerouslySetInnerHTML
 * - Content: Schema-defined HTML from page configuration
 * - Source: Validated Page schema (section.content property)
 * - Purpose: Render rich HTML content in structural elements
 * - Condition: content starts with '<' AND the resolver has not pinned it to
 *   the text branch via `data-content-plain-text`
 *
 * THAT SECOND CONDITION IS LOAD-BEARING. `startsWith('<')` used to be the only
 * gate, and an earlier version of this note said "Risk: Low - content is from
 * server configuration, not user input". That was FALSE for any content
 * carrying a `$record.*` binding: the author writes the literal `'$record.bio'`,
 * which does not start with `<`, and the RECORD then decides at request time
 * which branch this function takes. A stored value beginning with `<` flipped
 * the element into the raw-HTML path — stored XSS against every subsequent
 * visitor, needing no authentication to plant. Saying "Risk: Low" is exactly
 * what stopped the previous reader from checking.
 *
 * The verdict is now settled where provenance is still known.
 * `substituteRecordInContent` (presentation/rendering/data-source-resolver.ts)
 * decides HTML-vs-text from the AUTHOR's template alone: it HTML-escapes record
 * values interpolated into an author HTML template, and sets
 * `data-content-plain-text` whenever record data would otherwise have flipped
 * this branch. Do not "simplify" that pin away, and do not add a new
 * interpolation path into `content` without routing it through the same
 * function — by the time a string arrives here, author markup and record data
 * are one string and indistinguishable.
 *
 * For user-generated RICH TEXT that is meant to render as markup, use
 * renderCustomHTML, which applies the canonical `sanitizeRichTextHTML`.
 *
 * For section elements, automatically adds role="region" for accessibility best practices,
 * ensuring sections are properly identified in the accessibility tree.
 *
 * Supports scroll interactions via data attributes for IntersectionObserver.
 */
export function renderHTMLElement(config: HTMLElementConfig): ReactElement {
  const { type, props, content, children, interactions } = config
  const Element = type

  // Resolver→renderer signals, not markup: strip them here so they never reach
  // the DOM.
  //
  // `data-content-plain-text` is the content pin (see the note above) and is
  // named explicitly because it is the one signal that does NOT carry the
  // underscore prefix — it has to look like a `data-*` attribute upstream.
  //
  // The underscore-prefixed marker family is handled by `omitInternalMarkers`,
  // which every renderer that spreads author props onto a DOM element now
  // calls. This function used to enumerate six marker keys inline, and three
  // other renderers destructured their own — which is exactly why the leak
  // survived: a data source bound to a structural type landed here and was
  // clean, while the same source bound to a `link`, `image`, `audio`,
  // `iframe`, `list`, `paragraph` or form leaf reached a renderer that spread
  // props unfiltered, and React answered each one with "React does not
  // recognize the `_dataSourceBound` prop on a DOM element". Enumerating keys
  // per renderer closes one type at a time; the shared prefix test closes the
  // class. See `props/internal-marker-props.ts` for why the strip cannot move
  // upstream — the markers are read by the renderers that own their types.
  const { 'data-content-plain-text': plainTextPin, ...rest } = props
  const authorProps = omitInternalMarkers(rest)
  const contentIsPinnedToText = plainTextPin === true

  // Build element props immutably
  const accessibilityRole = buildAccessibilityRole(
    type,
    children.length > 0,
    !!content,
    authorProps.role
  )
  const scrollAttributes = buildScrollAttributes(interactions)
  const elementProps = { ...authorProps, ...accessibilityRole, ...scrollAttributes }

  // If the AUTHOR's content looks like HTML (starts with '<'), render as HTML.
  // Record-derived content never reaches this branch — see the note above.
  if (!contentIsPinnedToText && content?.trim().startsWith('<')) {
    return (
      <Element
        {...elementProps}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR HTML element renderer; one-shot during server render
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  return <Element {...elementProps}>{content || children}</Element>
}

/**
 * Configuration for renderStatusBadge — the badge variant that renders a
 * colored dot followed by a status label.
 */
export type StatusBadgeConfig = {
  readonly props: ElementProps
  readonly dotClassName: string
  readonly label: string | undefined
}

/**
 * Render the status-indicator variant of the `badge` component. Emits a
 * wrapper `<span>` (inheriting `props.id`, `props.className`, etc. exactly
 * like the default badge) containing a `<span data-status-dot>` for the dot
 * and a sibling `<span>` for the label text. The dot's color and pulse
 * animation are encoded as Tailwind utility classes on the dot's className.
 *
 * The wrapper is rendered with `inline-flex items-center gap-1.5` when no
 * author className is present so the dot and label line up; an author can
 * override by supplying their own `className` via `props.className`.
 */
export function renderStatusBadge(config: StatusBadgeConfig): ReactElement {
  const { props, dotClassName, label } = config
  const authorClassName = props.className
  const wrapperClassName = resolveClasses(
    'inline-flex items-center gap-1.5',
    typeof authorClassName === 'string' ? authorClassName : undefined
  )
  const wrapperProps = { ...omitInternalMarkers(props), className: wrapperClassName }
  return (
    <span {...wrapperProps}>
      <span
        data-status-dot
        className={dotClassName}
      />
      {label === undefined ? undefined : <span>{label}</span>}
    </span>
  )
}

/**
 * Renders heading elements (h1-h6)
 */
export function renderHeading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return <HeadingTag {...omitInternalMarkers(props)}>{content || children}</HeadingTag>
}

/**
 * Renders text element with dynamic level
 *
 * The text element supports a 'level' prop to determine the HTML tag.
 * If level is h1-h6, renders as heading.
 * If level is p, renders as paragraph.
 * If level is label, renders as label.
 * Otherwise renders as span to ensure proper ARIA generic role.
 */
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

  // Default to span for inline text to ensure proper ARIA generic role
  // span elements with text content maintain generic role in ARIA tree
  return <Tag {...omitInternalMarkers(props)}>{content || children}</Tag>
}
