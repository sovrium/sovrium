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
import { applyResponsiveOverrides, buildResponsiveClasses } from './responsive/responsive-resolver'
import { buildHoverData } from './styling/hover-interaction-handler'
import { resolveChildTranslation } from './translations/translation-handler'
import type {
  BlockReference,
  SimpleBlockReference,
} from '@/domain/models/app/block/common/block-reference'
import type { Blocks } from '@/domain/models/app/blocks'
import type { Languages } from '@/domain/models/app/languages'
import type { VariantOverrides } from '@/domain/models/app/page/common/responsive'
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

  // Apply responsive overrides for current breakpoint (used for SSR initial render)
  const responsiveOverrides = applyResponsiveOverrides(responsive, currentBreakpoint)

  // Build CSS-based responsive classes (works without JavaScript via Tailwind media queries)
  const baseClassName = componentProps?.className as string | undefined
  const responsiveClassName = buildResponsiveClasses(responsive, baseClassName)

  // Merge responsive overrides with base component values
  // For className, use CSS-based responsive classes instead of JS-based overrides
  const mergedPropsWithoutClassName: Record<string, unknown> | undefined = responsiveOverrides?.props
    ? Object.entries({ ...componentProps, ...responsiveOverrides.props })
        .filter(([key]) => key !== 'className')
        .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    : componentProps
      ? Object.entries(componentProps)
          .filter(([key]) => key !== 'className')
          .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      : undefined

  const mergedProps: Record<string, unknown> | undefined = responsiveClassName
    ? { ...mergedPropsWithoutClassName, className: responsiveClassName }
    : mergedPropsWithoutClassName

  const mergedChildren = responsiveOverrides?.children ?? children
  const mergedContent = responsiveOverrides?.content ?? content

  // Build CSS classes for responsive visibility using Tailwind breakpoint utilities
  // This works without JavaScript by using CSS media queries
  // Strategy: Convert responsive visibility config into appropriate Tailwind classes
  const responsiveVisibilityClasses = responsive
    ? (() => {
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
      })()
    : undefined

  // Build CSS classes for responsive props (className overrides) using Tailwind breakpoint prefixes
  // This works without JavaScript by using CSS media queries
  // Strategy: Convert responsive.{breakpoint}.props.className into prefixed classes (e.g., md:p-8)
  const responsivePropsClasses = responsive
    ? (() => {
        const breakpointClasses = (Object.entries(responsive) as [string, VariantOverrides][])
          .filter(([, overrides]) => overrides.props?.className)
          .flatMap(([bp, overrides]) => {
            const className = overrides.props!.className!
            // Split className into individual classes and prefix each with breakpoint
            return className
              .split(' ')
              .filter(Boolean)
              .map((cls) => `${bp}:${cls}`)
          })
          .join(' ')

        return breakpointClasses || undefined
      })()
    : undefined

  const mergedPropsWithVisibility = responsiveVisibilityClasses
    ? {
        ...mergedProps,
        className: mergedProps?.className
          ? `${mergedProps.className} ${responsiveVisibilityClasses}`
          : responsiveVisibilityClasses,
      }
    : mergedProps

  const mergedPropsWithResponsive = responsivePropsClasses
    ? {
        ...mergedPropsWithVisibility,
        className: mergedPropsWithVisibility?.className
          ? `${mergedPropsWithVisibility.className} ${responsivePropsClasses}`
          : responsivePropsClasses,
      }
    : mergedPropsWithVisibility

  const { elementProps, elementPropsWithSpacing } = buildComponentProps({
    type,
    props: mergedPropsWithResponsive,
    children: mergedChildren,
    content: mergedContent,
    blockName: props.blockName,
    blockInstanceIndex: props.blockInstanceIndex,
    theme: props.theme,
    languages: props.languages,
    currentLang: props.currentLang,
    childIndex: props.childIndex,
    interactions,
  })

  const hoverData = buildHoverData(interactions?.hover, uniqueId)
  const baseElementProps = mergeHoverAttributes(elementProps, hoverData)
  const baseElementPropsWithSpacing = mergeHoverAttributes(elementPropsWithSpacing, hoverData)
  const baseRenderedChildren = renderChildren(mergedChildren, props)

  // Resolve content with i18n priority: component.i18n[lang].content > $t: pattern > content
  const resolvedContent = resolveComponentContent(mergedContent, i18n, props.currentLang, props.languages)

  // Build i18n content data attribute and merge into element props (functional approach)
  const i18nContentAttribute =
    i18n && mergedContent
      ? buildI18nContentAttribute(i18n, mergedContent, props.languages?.default)
      : undefined
  const finalElementProps = buildFinalElementProps(baseElementProps, i18nContentAttribute)
  const finalElementPropsWithSpacing = buildFinalElementProps(
    baseElementPropsWithSpacing,
    i18nContentAttribute
  )

  // Check if component has meta property with structured data
  const meta = componentProps?.meta as BlockMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromBlock meta={meta} /> : undefined

  // Inject structured data script as first child if it exists (functional approach)
  const renderedChildren = structuredDataScript
    ? ([structuredDataScript, ...baseRenderedChildren] as readonly ReactElement[])
    : baseRenderedChildren

  const renderedComponent = dispatchComponentType({
    type,
    elementProps: finalElementProps,
    elementPropsWithSpacing: finalElementPropsWithSpacing,
    content: resolvedContent !== undefined ? resolvedContent : mergedContent,
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
