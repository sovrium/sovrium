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
import { buildResponsiveChildrenVariants } from './responsive/responsive-children-builder'
import { buildResponsiveContentVariants } from './responsive/responsive-content-builder'
import { mergeResponsiveProps } from './responsive/responsive-props-merger'
import { buildInteractionProps } from './styling/interaction-props-builder'
import { resolveI18nContent } from './translations/i18n-content-resolver'
import { resolveChildTranslation } from './translations/translation-handler'
import {
  substituteBlockVariables,
  substitutePropsVariables,
  substituteChildrenVariables,
} from './translations/variable-substitution'
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
  readonly pageVars?: Record<string, string | number | boolean>
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
      pageVars={props.pageVars}
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
        pageVars={props.pageVars}
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
// eslint-disable-next-line max-lines-per-function, max-statements, complexity -- React component with clear logic flow
function RenderDirectComponent({
  component,
  props,
}: {
  component: Component
  props: ComponentRendererProps
}): ReactElement | null {
  // Apply page-level variable substitution if pageVars are provided
  const substitutedComponent = props.pageVars
    ? {
        ...component,
        props: substitutePropsVariables(component.props, props.pageVars),
        children: substituteChildrenVariables(component.children, props.pageVars),
        content:
          typeof component.content === 'string'
            ? (substituteBlockVariables(component.content, props.pageVars) as string)
            : component.content,
      }
    : component

  const {
    type,
    props: componentProps,
    children,
    content,
    interactions,
    i18n,
    responsive,
  } = substitutedComponent
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

  // Add data-component-type attribute for testing
  const finalElementPropsWithType = {
    ...finalElementProps,
    'data-component-type': type,
  }
  const finalElementPropsWithSpacingAndType = {
    ...finalElementPropsWithSpacing,
    'data-component-type': type,
  }

  // Check if component has meta property with structured data
  const meta = componentProps?.meta as BlockMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromBlock meta={meta} /> : undefined

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
      finalElementPropsWithType,
      finalElementPropsWithSpacingAndType
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

  // Check if component has responsive children overrides
  const hasResponsiveChildren =
    responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).children !== undefined
    )

  // Use CSS-based responsive children variants for SSR compatibility
  const finalRenderedChildren = hasResponsiveChildren
    ? buildResponsiveChildrenVariants({
        responsive: responsive!,
        baseChildren: baseRenderedChildren,
        renderChild: (child, index, breakpoint, additionalClassName) => {
          if (typeof child === 'string') {
            const resolvedText = resolveChildTranslation(child, props.currentLang, props.languages)
            // Wrap text in span with visibility class for CSS-based hiding
            return (
              <span
                key={`${breakpoint}-${index}`}
                className={additionalClassName}
                data-responsive-breakpoint={breakpoint}
              >
                {resolvedText}
              </span>
            )
          }

          // Inject visibility className into child component's props
          const childWithVisibility: Component = additionalClassName
            ? {
                ...child,
                props: {
                  ...(child.props || {}),
                  className: (child.props as { className?: string } | undefined)?.className
                    ? `${(child.props as { className: string }).className} ${additionalClassName}`
                    : additionalClassName,
                } as Record<string, unknown>,
              }
            : child

          return (
            <ComponentRenderer
              key={`${breakpoint}-${index}`}
              component={childWithVisibility}
              pageVars={props.pageVars}
              blocks={props.blocks}
              theme={props.theme}
              languages={props.languages}
              currentLang={props.currentLang}
              childIndex={index}
            />
          )
        },
      })
    : baseRenderedChildren

  // Inject structured data script as first child if it exists
  const finalChildren = structuredDataScript
    ? ([structuredDataScript, ...finalRenderedChildren] as readonly ReactElement[])
    : finalRenderedChildren

  // Default rendering without responsive content
  const renderedComponent = dispatchComponentType({
    type,
    elementProps: finalElementPropsWithType,
    elementPropsWithSpacing: finalElementPropsWithSpacingAndType,
    content:
      resolvedContent !== undefined
        ? resolvedContent
        : typeof mergedContent === 'string'
          ? mergedContent
          : undefined,
    renderedChildren: finalChildren,
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
