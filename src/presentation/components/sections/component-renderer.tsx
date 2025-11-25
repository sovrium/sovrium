/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment, useId } from 'react'
import {
  StructuredDataFromBlock,
  type BlockMeta,
} from '@/presentation/components/metadata/structured-data-from-block'
import { useBreakpoint } from '@/presentation/hooks/use-breakpoint'
import { extractBlockReference, renderBlockReferenceError } from './blocks/block-reference-handler'
import { resolveBlock } from './blocks/block-resolution'
import { buildComponentProps } from './props/component-builder'
import { dispatchComponentType } from './rendering/component-type-dispatcher'
import { buildResponsiveContentVariants } from './responsive/responsive-content-builder'
import { mergeResponsiveProps } from './responsive/responsive-props-merger'
import { buildInteractionProps } from './styling/interaction-props-builder'
import { resolveI18nContent } from './translations/i18n-content-resolver'
import { resolveChildTranslation } from './translations/translation-handler'
import type {
  BlockReference,
  SimpleBlockReference,
} from '@/domain/models/app/block/common/block-reference'
import type { Blocks } from '@/domain/models/app/blocks'
import type { Languages } from '@/domain/models/app/languages'
import type { Responsive, VariantOverrides } from '@/domain/models/app/page/common/responsive'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Component renderer props
 */
type ComponentRendererProps = {
  readonly component: Component | SimpleBlockReference | BlockReference
  readonly blockName?: string
  readonly blockInstanceIndex?: number
  readonly blocks?: Blocks
  readonly theme?: Theme
  readonly languages?: Languages
  readonly currentLang?: string
  readonly childIndex?: number
}

/**
 * Handles block reference resolution and rendering
 *
 * @param component - Block reference component
 * @param props - Component renderer props
 * @returns Rendered block reference or error
 */
function renderBlockReference(
  component: SimpleBlockReference | BlockReference,
  props: ComponentRendererProps
): ReactElement | null {
  const { refName, vars } = extractBlockReference(component)
  const resolved = resolveBlock(refName, props.blocks, vars)

  if (!resolved) {
    return renderBlockReferenceError({ refName, blocks: props.blocks })
  }

  return (
    <ComponentRenderer
      component={resolved.component}
      blockName={resolved.name}
      blockInstanceIndex={props.blockInstanceIndex}
      blocks={props.blocks}
      theme={props.theme}
      languages={props.languages}
      currentLang={props.currentLang}
    />
  )
}

/**
 * Renders children recursively
 *
 * @param children - Child components or strings
 * @param props - Component renderer props
 * @returns Rendered children elements (cast to ReactElement[] for compatibility)
 */
function renderChildren(
  children: ReadonlyArray<Component | string> | undefined,
  props: ComponentRendererProps
): readonly ReactElement[] {
  if (!children) return []

  return children.map((child: Component | string, index: number) =>
    typeof child === 'string' ? (
      resolveChildTranslation(child, props.currentLang, props.languages)
    ) : (
      <ComponentRenderer
        key={index}
        component={child}
        blocks={props.blocks}
        theme={props.theme}
        languages={props.languages}
        currentLang={props.currentLang}
        childIndex={index}
      />
    )
  ) as ReactElement[]
}

/**
 * Map breakpoints to Tailwind visibility classes
 */
const BREAKPOINT_VISIBILITY_CLASSES: Record<string, string> = {
  mobile: 'lg:hidden', // Show only on mobile (hide on lg and above)
  lg: 'max-lg:hidden', // Show only on desktop lg+ (hide below lg)
  md: 'max-md:hidden lg:hidden', // Show only on md (hide below md and on lg+)
  sm: 'max-sm:hidden md:hidden', // Show only on sm (hide below sm and on md+)
  xl: 'max-xl:hidden', // Show only on xl+ (hide below xl)
  '2xl': 'max-2xl:hidden', // Show only on 2xl+ (hide below 2xl)
} as const

/**
 * Renders a single responsive child with visibility class
 */
function renderResponsiveChild(
  child: Component | string,
  breakpoint: string,
  index: number,
  visibilityClass: string,
  props: ComponentRendererProps
): ReactElement {
  if (typeof child === 'string') {
    return (
      <span
        key={`${breakpoint}-${index}`}
        className={visibilityClass}
      >
        {resolveChildTranslation(child, props.currentLang, props.languages)}
      </span>
    )
  }

  const childWithVisibility: Component = {
    ...child,
    props: {
      ...child.props,
      className: child.props?.className
        ? `${child.props.className} ${visibilityClass}`
        : visibilityClass,
    },
  }

  return (
    <ComponentRenderer
      key={`${breakpoint}-${index}`}
      component={childWithVisibility}
      blocks={props.blocks}
      theme={props.theme}
      languages={props.languages}
      currentLang={props.currentLang}
      childIndex={index}
    />
  )
}

/**
 * Renders responsive children with CSS-based visibility
 */
function renderResponsiveChildren(
  responsive: Responsive | undefined,
  baseChildren: ReadonlyArray<Component | string> | undefined,
  props: ComponentRendererProps
): readonly ReactElement[] {
  if (!responsive) {
    return renderChildren(baseChildren, props)
  }

  const hasResponsiveChildren = Object.values(responsive).some(
    (overrides: VariantOverrides) => overrides.children !== undefined
  )

  if (!hasResponsiveChildren) {
    return renderChildren(baseChildren, props)
  }

  // Collect breakpoint children with visibility classes
  const breakpointChildren = Object.entries(responsive)
    .filter(([, overrides]: [string, VariantOverrides]) => overrides.children !== undefined)
    .map(([breakpoint, overrides]: [string, VariantOverrides]) => ({
      breakpoint,
      children: overrides.children!,
      visibilityClass: BREAKPOINT_VISIBILITY_CLASSES[breakpoint] || '',
    }))

  if (breakpointChildren.length === 0) {
    return renderChildren(baseChildren, props)
  }

  // Render all children with visibility classes (functional approach)
  return breakpointChildren.flatMap(({ breakpoint, children, visibilityClass }) =>
    children.map((child: Component | string, index: number) =>
      renderResponsiveChild(child, breakpoint, index, visibilityClass, props)
    )
  )
}

/**
 * Renders direct component (non-block-reference)
 *
 * This is a React component (not a helper function) because it uses the useId hook.
 * React components must start with an uppercase letter.
 *
 * @param component - Direct component
 * @param props - Component renderer props
 * @returns Rendered component
 */
// eslint-disable-next-line max-lines-per-function, max-statements, complexity -- React component with clear logic flow
function RenderDirectComponent({
  component,
  props,
}: {
  component: Component
  props: ComponentRendererProps
}): ReactElement | null {
  const {
    type,
    props: componentProps,
    children,
    content,
    interactions,
    i18n,
    responsive,
  } = component
  const uniqueId = useId()
  const currentBreakpoint = useBreakpoint()

  // Merge responsive props using extracted module
  const {
    mergedProps: mergedPropsWithVisibility,
    mergedChildren,
    mergedContent,
  } = mergeResponsiveProps(responsive, componentProps, children, content, currentBreakpoint)

  const { elementProps, elementPropsWithSpacing } = buildComponentProps({
    type,
    props: mergedPropsWithVisibility,
    children: mergedChildren,
    content: typeof mergedContent === 'string' ? mergedContent : undefined,
    blockName: props.blockName,
    blockInstanceIndex: props.blockInstanceIndex,
    theme: props.theme,
    languages: props.languages,
    currentLang: props.currentLang,
    childIndex: props.childIndex,
    interactions,
  })

  // Build interaction props using extracted module
  const {
    finalElementProps: interactionElementProps,
    finalElementPropsWithSpacing: interactionElementPropsWithSpacing,
    hoverData,
  } = buildInteractionProps(interactions, uniqueId, elementProps, elementPropsWithSpacing)

  const baseRenderedChildren = renderChildren(mergedChildren, props)

  // Resolve i18n content using extracted module
  const { resolvedContent, finalElementProps, finalElementPropsWithSpacing } = resolveI18nContent(
    mergedContent,
    i18n,
    props.currentLang,
    props.languages,
    interactionElementProps,
    interactionElementPropsWithSpacing
  )

  // Check if component has meta property with structured data
  const meta = componentProps?.meta as BlockMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromBlock meta={meta} /> : undefined

  // Inject structured data script as first child if it exists (functional approach)
  const renderedChildren = structuredDataScript
    ? ([structuredDataScript, ...baseRenderedChildren] as readonly ReactElement[])
    : baseRenderedChildren

  // Check if component has responsive content overrides
  const hasResponsiveContent =
    responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).content !== undefined
    )

  // Use CSS-based responsive content variants for SSR compatibility
  if (hasResponsiveContent) {
    const responsiveVariants = buildResponsiveContentVariants(
      responsive!,
      type,
      finalElementProps,
      finalElementPropsWithSpacing
    )

    if (hoverData) {
      return (
        <Fragment>
          <style>{hoverData.styleContent}</style>
          {responsiveVariants}
        </Fragment>
      )
    }

    return responsiveVariants
  }

  // Default rendering without responsive content
  const renderedComponent = dispatchComponentType({
    type,
    elementProps: finalElementProps,
    elementPropsWithSpacing: finalElementPropsWithSpacing,
    content:
      resolvedContent !== undefined
        ? resolvedContent
        : typeof mergedContent === 'string'
          ? mergedContent
          : undefined,
    renderedChildren,
    theme: props.theme,
    languages: props.languages,
    interactions,
  })

  if (hoverData) {
    return (
      <Fragment>
        <style>{hoverData.styleContent}</style>
        {renderedComponent}
      </Fragment>
    )
  }

  return renderedComponent
}

/**
 * ComponentRenderer - Renders a dynamic component based on its type
 *
 * This component handles the recursive rendering of sections, converting
 * the declarative component configuration into React elements.
 * Supports block references for reusable components and theme token substitution.
 *
 * @param props - Component props
 * @param props.component - Component configuration from sections schema (can be a direct component or block reference)
 * @param props.blockName - Optional block name for data-block attribute
 * @param props.blockInstanceIndex - Optional instance index for blocks used multiple times (for unique data-testid)
 * @param props.blocks - Optional blocks array for resolving block references
 * @param props.theme - Optional theme configuration for token substitution
 * @param props.languages - Optional languages configuration for language-switcher blocks
 * @param props.currentLang - Current page language (defaults to languages.default)
 * @returns React element matching the component type
 */
export function ComponentRenderer(props: ComponentRendererProps): Readonly<ReactElement | null> {
  const { component } = props

  // Handle block references - supports both { block: 'name' } and { $ref: 'name' } syntaxes
  if ('block' in component || '$ref' in component) {
    return renderBlockReference(component, props)
  }

  // Direct component rendering
  return (
    <RenderDirectComponent
      component={component as Component}
      props={props}
    />
  )
}
