/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines, max-lines-per-function, max-statements -- Complex component renderer with many helpers */

import { type ReactElement, Fragment, useId } from 'react'
import { useBreakpoint } from '@/presentation/hooks/use-breakpoint'
import {
  StructuredDataFromComponent,
  type ComponentMeta,
} from '@/presentation/ui/metadata/structured-data-from-component'
import {
  extractComponentReference,
  renderComponentReferenceError,
} from './components/component-reference-handler'
import { resolveComponent } from './components/component-resolution'
import { buildComponentProps } from './props/component-builder'
import { dispatchComponentType } from './rendering/component-type-dispatcher'
import { buildResponsiveChildrenVariants } from './responsive/responsive-children-builder'
import { buildResponsiveContentVariants } from './responsive/responsive-content-builder'
import { mergeResponsiveProps } from './responsive/responsive-props-merger'
import { buildInteractionProps } from './styling/interaction-props-builder'
import { resolveI18nContent } from './translations/i18n-content-resolver'
import { resolveChildTranslation } from './translations/translation-handler'
import {
  substituteVariableValues,
  substitutePropsVariables,
  substituteChildrenVariables,
} from './translations/variable-substitution'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { VariantOverrides } from '@/domain/models/app/page/common/responsive'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Component renderer props
 */
type ComponentRendererProps = {
  readonly component: Component | SimpleComponentReference | ComponentReference
  readonly pageVars?: Record<string, string | number | boolean>
  readonly componentName?: string
  readonly componentInstanceIndex?: number
  readonly components?: Components
  readonly theme?: Theme
  readonly languages?: Languages
  readonly currentLang?: string
  readonly childIndex?: number
}

/**
 * Handles component reference resolution and rendering
 *
 * @param component - Component reference
 * @param props - Component renderer props
 * @returns Rendered component reference or error
 */
function renderComponentReference(
  component: SimpleComponentReference | ComponentReference,
  props: ComponentRendererProps
): ReactElement | null {
  const { refName, vars } = extractComponentReference(component)
  const resolved = resolveComponent(refName, props.components, vars)

  if (!resolved) {
    return renderComponentReferenceError({ refName, components: props.components })
  }

  return (
    <ComponentRenderer
      component={resolved.component}
      pageVars={props.pageVars}
      componentName={resolved.name}
      componentInstanceIndex={props.componentInstanceIndex}
      components={props.components}
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
        components={props.components}
        theme={props.theme}
        languages={props.languages}
        currentLang={props.currentLang}
        childIndex={index}
      />
    )
  ) as ReactElement[]
}

/**
 * Apply page-level variable substitution to component
 */
function applyVariableSubstitution(
  component: Component,
  pageVars: ComponentRendererProps['pageVars']
): Component {
  if (!pageVars) return component

  return {
    ...component,
    props: substitutePropsVariables(component.props, pageVars),
    children: substituteChildrenVariables(component.children, pageVars),
    content:
      typeof component.content === 'string'
        ? (substituteVariableValues(component.content, pageVars) as string)
        : component.content,
  }
}

/**
 * Add data-component-type attribute for testing
 */
function addComponentTypeAttribute(
  elementProps: Record<string, unknown>,
  type: string
): Record<string, unknown> {
  return {
    ...elementProps,
    'data-component-type': type,
  }
}

/**
 * Check if component has responsive content overrides
 */
function hasResponsiveContentOverrides(responsive: Component['responsive']): boolean {
  return (
    !!responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).content !== undefined
    )
  )
}

/**
 * Check if component has responsive children overrides
 */
function hasResponsiveChildrenOverrides(responsive: Component['responsive']): boolean {
  return (
    !!responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).children !== undefined
    )
  )
}

/**
 * Render component with responsive content variants
 */
function renderWithResponsiveContent(config: {
  responsive: Component['responsive']
  type: string
  finalElementPropsWithType: Record<string, unknown>
  finalElementPropsWithSpacingAndType: Record<string, unknown>
  hoverData?: { styleContent: string }
}): ReactElement | null {
  const responsiveVariants = buildResponsiveContentVariants(
    config.responsive!,
    config.type,
    config.finalElementPropsWithType,
    config.finalElementPropsWithSpacingAndType
  )

  if (config.hoverData) {
    return (
      <Fragment>
        <style>{config.hoverData.styleContent}</style>
        {responsiveVariants}
      </Fragment>
    )
  }

  return responsiveVariants
}

/**
 * Build responsive children with variant rendering
 */
function buildResponsiveChildren(
  responsive: Component['responsive'],
  baseChildren: readonly ReactElement[],
  props: ComponentRendererProps
): readonly ReactElement[] {
  return buildResponsiveChildrenVariants({
    responsive: responsive!,
    baseChildren,
    renderChild: (child, index, breakpoint, additionalClassName) => {
      if (typeof child === 'string') {
        const resolvedText = resolveChildTranslation(child, props.currentLang, props.languages)
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
          components={props.components}
          theme={props.theme}
          languages={props.languages}
          currentLang={props.currentLang}
          childIndex={index}
        />
      )
    },
  })
}

/**
 * Renders direct component (non-reference)
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
  // Apply page-level variable substitution if pageVars are provided
  const substitutedComponent = applyVariableSubstitution(component, props.pageVars)

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
    componentName: props.componentName,
    componentInstanceIndex: props.componentInstanceIndex,
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
  const finalElementPropsWithType = addComponentTypeAttribute(finalElementProps, type)
  const finalElementPropsWithSpacingAndType = addComponentTypeAttribute(
    finalElementPropsWithSpacing,
    type
  )

  // Check if component has meta property with structured data
  const meta = componentProps?.meta as ComponentMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromComponent meta={meta} /> : undefined

  // Check if component has responsive content overrides
  if (hasResponsiveContentOverrides(responsive)) {
    return renderWithResponsiveContent({
      responsive,
      type,
      finalElementPropsWithType,
      finalElementPropsWithSpacingAndType,
      hoverData,
    })
  }

  // Check if component has responsive children overrides
  const finalRenderedChildren = hasResponsiveChildrenOverrides(responsive)
    ? buildResponsiveChildren(responsive, baseRenderedChildren, props)
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
 * Supports component references for reusable components and theme token substitution.
 *
 * @param props - Component props
 * @param props.component - Component configuration from sections schema (can be a direct component or component reference)
 * @param props.componentName - Optional component template name for data-component attribute
 * @param props.componentInstanceIndex - Optional instance index for components used multiple times (for unique data-testid)
 * @param props.components - Optional components array for resolving component references
 * @param props.theme - Optional theme configuration for token substitution
 * @param props.languages - Optional languages configuration for language-switcher components
 * @param props.currentLang - Current page language (defaults to languages.default)
 * @returns React element matching the component type
 */
export function ComponentRenderer(props: ComponentRendererProps): Readonly<ReactElement | null> {
  const { component } = props

  // Handle component references - supports both { component: 'name' } and { $ref: 'name' } syntaxes
  if ('component' in component || '$ref' in component) {
    return renderComponentReference(component, props)
  }

  // Direct component rendering
  return (
    <RenderDirectComponent
      component={component as Component}
      props={props}
    />
  )
}
