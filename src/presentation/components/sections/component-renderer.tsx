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
import { useBreakpoint, type Breakpoint } from '@/presentation/hooks/use-breakpoint'
import { extractBlockReference, renderBlockReferenceError } from './blocks/block-reference-handler'
import { resolveBlock } from './blocks/block-resolution'
import { buildComponentProps } from './props/component-builder'
import { dispatchComponentType } from './rendering/component-type-dispatcher'
import { applyResponsiveOverrides, buildResponsiveClasses } from './responsive/responsive-resolver'
import { buildHoverData } from './styling/hover-interaction-handler'
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
 * Merges hover attributes into element props
 *
 * @param elementProps - Base element props
 * @param hoverData - Hover data with attributes
 * @returns Element props with hover attributes merged
 */
function mergeHoverAttributes(
  elementProps: Record<string, unknown>,
  hoverData: { readonly attributes: Record<string, string> } | undefined
): Record<string, unknown> {
  return hoverData ? { ...elementProps, ...hoverData.attributes } : elementProps
}

/**
 * Builds i18n content data attribute for client-side language switching (functional approach)
 *
 * Extracts content translations from i18n object and serializes to JSON.
 * Includes default language content as fallback.
 *
 * @param i18n - Component i18n translations object
 * @param defaultContent - Default content for base language
 * @param defaultLang - Default language code
 * @returns JSON-stringified i18n content data or undefined if no translations
 */
function buildI18nContentAttribute(
  i18n: Record<string, unknown>,
  defaultContent: string,
  defaultLang: string | undefined
): string | undefined {
  // Extract content from i18n object using functional approach (reduce instead of for loop)
  const i18nContentData = Object.entries(i18n).reduce<Record<string, string>>(
    (acc, [lang, value]) => {
      if (typeof value === 'object' && value !== null && 'content' in value && value.content) {
        return { ...acc, [lang]: value.content as string }
      }
      return acc
    },
    {}
  )

  // Add default language content if not already present
  const contentWithDefault =
    defaultLang && !i18nContentData[defaultLang]
      ? { ...i18nContentData, [defaultLang]: defaultContent }
      : i18nContentData

  // Only return attribute if there are translations
  return Object.keys(contentWithDefault).length > 0 ? JSON.stringify(contentWithDefault) : undefined
}

/**
 * Resolves component content with i18n priority
 *
 * Priority: component.i18n[lang].content > $t: pattern > content
 *
 * @param content - Base content string
 * @param i18n - Component i18n translations
 * @param currentLang - Current language code
 * @param languages - Languages configuration
 * @returns Resolved content string
 */
function resolveComponentContent(
  content: string | Record<string, unknown> | undefined,
  i18n: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  // If content is an object (structured content like { button: {...} }), return undefined
  // The component renderer will handle structured content directly
  if (content && typeof content === 'object') {
    return undefined
  }

  if (i18n && currentLang) {
    const langData = i18n[currentLang]
    if (
      langData &&
      typeof langData === 'object' &&
      'content' in langData &&
      typeof langData.content === 'string'
    ) {
      return langData.content
    }
  }
  if (content) {
    return resolveChildTranslation(content, currentLang, languages)
  }
  return content
}

/**
 * Builds final element props with i18n data attribute
 *
 * @param baseProps - Base element props
 * @param i18nAttribute - Optional i18n content JSON string
 * @returns Element props with i18n data merged if present
 */
function buildFinalElementProps(
  baseProps: Record<string, unknown>,
  i18nAttribute: string | undefined
): Record<string, unknown> {
  return i18nAttribute ? { ...baseProps, 'data-i18n-content': i18nAttribute } : baseProps
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
 * Config for rendering responsive child
 */
type ResponsiveChildConfig = {
  readonly child: Component | string
  readonly breakpoint: string
  readonly index: number
  readonly visibilityClass: string
}

/**
 * Renders a single responsive child with visibility class
 */
function renderResponsiveChild(
  config: ResponsiveChildConfig,
  props: ComponentRendererProps
): ReactElement {
  const { child, breakpoint, index, visibilityClass } = config

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
      renderResponsiveChild({ child, breakpoint, index, visibilityClass }, props)
    )
  )
}

/**
 * Merges responsive props without className
 */
function mergeResponsivePropsWithoutClassName(
  componentProps: Record<string, unknown> | undefined,
  responsiveOverrides: VariantOverrides | undefined
): Record<string, unknown> | undefined {
  const propsToMerge = responsiveOverrides?.props
    ? { ...componentProps, ...responsiveOverrides.props }
    : componentProps

  if (!propsToMerge) {
    return undefined
  }

  return Object.entries(propsToMerge)
    .filter(([key]) => key !== 'className')
    .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
}

/**
 * Builds responsive visibility classes from responsive config
 */
function buildResponsiveVisibilityClasses(
  responsive: Responsive | undefined
): string | undefined {
  if (!responsive) {
    return undefined
  }

  const visibilityConfig = (Object.entries(responsive) as [string, VariantOverrides][])
    .filter(([, overrides]) => overrides.visible !== undefined)
    .reduce<Record<string, boolean>>((acc, [bp, overrides]) => {
      return { ...acc, [bp]: overrides.visible! }
    }, {})

  // For mobile:false + lg:true pattern, use max-lg:hidden
  if (visibilityConfig.mobile === false && visibilityConfig.lg === true) {
    return 'max-lg:hidden'
  }

  // For mobile:true + lg:false pattern, use lg:hidden
  if (visibilityConfig.mobile === true && visibilityConfig.lg === false) {
    return 'lg:hidden'
  }

  // Default fallback: build individual responsive classes
  return Object.entries(visibilityConfig)
    .map(([bp, isVisible]) => {
      if (bp === 'mobile') {
        return isVisible ? '' : 'max-sm:hidden'
      }
      return isVisible ? `${bp}:inline` : `${bp}:hidden`
    })
    .filter(Boolean)
    .join(' ')
}

/**
 * Checks if responsive children should be used
 */
function hasResponsiveChildren(responsive: Responsive | undefined): boolean {
  if (!responsive) {
    return false
  }
  return (Object.values(responsive) as VariantOverrides[]).some(
    (override) => override.children !== undefined
  )
}

/**
 * Merges responsive props with visibility classes
 */
function mergePropsWithResponsiveVisibility(
  mergedProps: Record<string, unknown> | undefined,
  responsiveClassName: string | undefined,
  responsiveVisibilityClasses: string | undefined
): Record<string, unknown> | undefined {
  // First add responsive className if present
  const propsWithClassName = responsiveClassName
    ? { ...mergedProps, className: responsiveClassName }
    : mergedProps

  // Then add visibility classes if present
  if (!responsiveVisibilityClasses) {
    return propsWithClassName
  }

  return {
    ...propsWithClassName,
    className: propsWithClassName?.className
      ? `${propsWithClassName.className} ${responsiveVisibilityClasses}`
      : responsiveVisibilityClasses,
  }
}

/**
 * Builds final rendered children with structured data
 */
function buildFinalRenderedChildren(
  structuredDataScript: ReactElement | undefined,
  baseRenderedChildren: readonly ReactElement[]
): readonly ReactElement[] {
  if (!structuredDataScript) {
    return baseRenderedChildren
  }
  return [structuredDataScript, ...baseRenderedChildren] as readonly ReactElement[]
}

/**
 * Wraps component with hover styles if needed
 */
function wrapWithHoverStyles(
  hoverData: { readonly styleContent: string } | undefined,
  renderedComponent: ReactElement | null
): ReactElement | null {
  if (!hoverData) {
    return renderedComponent
  }

  return (
    <Fragment>
      <style>{hoverData.styleContent}</style>
      {renderedComponent}
    </Fragment>
  )
}

/**
 * Config for preparing responsive data
 */
type PrepareResponsiveDataConfig = {
  readonly responsive: Responsive | undefined
  readonly currentBreakpoint: Breakpoint
  readonly componentProps: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<Component | string> | undefined
  readonly content: string | Record<string, unknown> | undefined
}

/**
 * Prepares responsive data for component rendering
 */
function prepareResponsiveData(config: PrepareResponsiveDataConfig) {
  const { responsive, currentBreakpoint, componentProps, children, content } = config

  const responsiveOverrides = applyResponsiveOverrides(responsive, currentBreakpoint)
  const baseClassName = componentProps?.className as string | undefined
  const responsiveClassName = buildResponsiveClasses(responsive, baseClassName)
  const mergedPropsWithoutClassName = mergeResponsivePropsWithoutClassName(
    componentProps,
    responsiveOverrides
  )

  const useResponsiveChildren = hasResponsiveChildren(responsive)
  const mergedChildren = useResponsiveChildren ? children : responsiveOverrides?.children ?? children
  const mergedContent = responsiveOverrides?.content ?? content

  const responsiveVisibilityClasses = buildResponsiveVisibilityClasses(responsive)
  const mergedPropsWithVisibility = mergePropsWithResponsiveVisibility(
    mergedPropsWithoutClassName,
    responsiveClassName,
    responsiveVisibilityClasses
  )

  return {
    mergedPropsWithVisibility,
    mergedChildren,
    mergedContent,
  }
}

/**
 * Config for preparing element props
 */
type PrepareElementPropsConfig = {
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly hoverData: { readonly attributes: Record<string, string> } | undefined
  readonly i18n: Record<string, unknown> | undefined
  readonly mergedContent: string | Record<string, unknown> | undefined
  readonly languages: Languages | undefined
  readonly componentProps: Record<string, unknown> | undefined
}

/**
 * Prepares element props with i18n and structured data
 */
function prepareElementProps(config: PrepareElementPropsConfig) {
  const {
    elementProps,
    elementPropsWithSpacing,
    hoverData,
    i18n,
    mergedContent,
    languages,
    componentProps,
  } = config

  const baseElementProps = mergeHoverAttributes(elementProps, hoverData)
  const baseElementPropsWithSpacing = mergeHoverAttributes(elementPropsWithSpacing, hoverData)

  const i18nContentAttribute =
    i18n && typeof mergedContent === 'string'
      ? buildI18nContentAttribute(i18n, mergedContent, languages?.default)
      : undefined

  const finalElementProps = buildFinalElementProps(baseElementProps, i18nContentAttribute)
  const finalElementPropsWithSpacing = buildFinalElementProps(
    baseElementPropsWithSpacing,
    i18nContentAttribute
  )

  const meta = componentProps?.meta as BlockMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromBlock meta={meta} /> : undefined

  return {
    finalElementProps,
    finalElementPropsWithSpacing,
    structuredDataScript,
  }
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
function RenderDirectComponent({
  component,
  props,
}: {
  component: Component
  props: ComponentRendererProps
}): ReactElement | null {
  const { type, props: componentProps, children, content, interactions, i18n, responsive } = component
  const uniqueId = useId()
  const currentBreakpoint = useBreakpoint()

  // Prepare responsive data (overrides, merged props, children, content)
  const { mergedPropsWithVisibility, mergedChildren, mergedContent } = prepareResponsiveData({
    responsive,
    currentBreakpoint,
    componentProps,
    children,
    content,
  })

  // Build component props with all attributes
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

  // Prepare final element props with hover, i18n, and structured data
  const hoverData = buildHoverData(interactions?.hover, uniqueId)
  const { finalElementProps, finalElementPropsWithSpacing, structuredDataScript } = prepareElementProps({
    elementProps,
    elementPropsWithSpacing,
    hoverData,
    i18n,
    mergedContent,
    languages: props.languages,
    componentProps,
  })

  // Render children and inject structured data script if present
  const baseRenderedChildren = renderResponsiveChildren(responsive, children, props)
  const renderedChildren = buildFinalRenderedChildren(structuredDataScript, baseRenderedChildren)

  // Resolve content with i18n priority: component.i18n[lang].content > $t: pattern > content
  const resolvedContent = resolveComponentContent(mergedContent, i18n, props.currentLang, props.languages)

  // Dispatch to appropriate component renderer
  const renderedComponent = dispatchComponentType({
    type,
    elementProps: finalElementProps,
    elementPropsWithSpacing: finalElementPropsWithSpacing,
    content: resolvedContent !== undefined ? resolvedContent : (typeof mergedContent === 'string' ? mergedContent : undefined),
    renderedChildren,
    theme: props.theme,
    languages: props.languages,
    interactions,
  })

  return wrapWithHoverStyles(hoverData, renderedComponent)
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
  // Note: We don't add key={breakpoint} here because it would break React's reconciliation
  // and cause unnecessary unmount/remount cycles. The component should re-render naturally
  // when state changes from useBreakpoint hook.
  return (
    <RenderDirectComponent
      component={component as Component}
      props={props}
    />
  )
}
