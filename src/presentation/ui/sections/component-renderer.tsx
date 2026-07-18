/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
import {
  buildTypeSpecificElementProps,
  resolveTypeSpecificInputs,
} from './props/type-specific-props-builder'
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
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { VariantOverrides } from '@/domain/models/app/pages/components/responsive'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { SessionInfo } from '@/domain/types/session-info'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'

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
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  readonly session?: SessionInfo
}

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
      tables={props.tables}
      buckets={props.buckets}
      landingPath={props.landingPath}
      routeParams={props.routeParams}
      session={props.session}
    />
  )
}

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
        tables={props.tables}
        buckets={props.buckets}
        landingPath={props.landingPath}
        routeParams={props.routeParams}
        session={props.session}
      />
    )
  ) as ReactElement[]
}

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

function addComponentTypeAttribute(
  elementProps: Record<string, unknown>,
  type: string
): Record<string, unknown> {
  return {
    ...elementProps,
    'data-component-type': type,
  }
}

function hasResponsiveContentOverrides(responsive: Component['responsive']): boolean {
  return (
    !!responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).content !== undefined
    )
  )
}

function hasResponsiveChildrenOverrides(responsive: Component['responsive']): boolean {
  return (
    !!responsive &&
    Object.values(responsive).some(
      (override) => (override as VariantOverrides).children !== undefined
    )
  )
}

function renderWithResponsiveContent(config: {
  responsive: Component['responsive']
  type: string
  finalElementPropsWithType: Record<string, unknown>
  finalElementPropsWithSpacingAndType: Record<string, unknown>
  hoverData?: { styleContent: string }
  component?: Component
}): ReactElement | null {
  const responsiveVariants = buildResponsiveContentVariants({
    responsive: config.responsive!,
    type: config.type,
    elementProps: config.finalElementPropsWithType,
    elementPropsWithSpacing: config.finalElementPropsWithSpacingAndType,
    component: config.component,
  })

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
          tables={props.tables}
          buckets={props.buckets}
          routeParams={props.routeParams}
          session={props.session}
        />
      )
    },
  })
}

function RenderDirectComponent({
  component,
  props,
}: {
  component: Component
  props: ComponentRendererProps
}): ReactElement | null {
  const substitutedComponent = applyVariableSubstitution(component, props.pageVars)

  const {
    type,
    props: componentProps,
    children,
    content,
    interactions: topLevelInteractions,
    i18n,
    responsive,
  } = substitutedComponent
  const interactions =
    topLevelInteractions ?? (componentProps?.interactions as typeof topLevelInteractions)
  const uniqueId = useId()
  const currentBreakpoint = useBreakpoint()

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
    variant: (substitutedComponent as { variant?: string }).variant,
    size: (substitutedComponent as { size?: string }).size,
    badgeVariant: (substitutedComponent as { badgeVariant?: string }).badgeVariant,
  })

  const {
    finalElementProps: interactionElementProps,
    finalElementPropsWithSpacing: interactionElementPropsWithSpacing,
    hoverData,
  } = buildInteractionProps(interactions, uniqueId, elementProps, elementPropsWithSpacing)

  const baseRenderedChildren = renderChildren(mergedChildren, props)

  const { resolvedContent, finalElementProps, finalElementPropsWithSpacing } = resolveI18nContent({
    content: mergedContent,
    i18n,
    currentLang: props.currentLang,
    languages: props.languages,
    elementProps: interactionElementProps,
    elementPropsWithSpacing: interactionElementPropsWithSpacing,
  })

  const baseElementPropsWithType = addComponentTypeAttribute(finalElementProps, type)
  const finalElementPropsWithSpacingAndType = addComponentTypeAttribute(
    finalElementPropsWithSpacing,
    type
  )

  const resolvedTypeInputs = resolveTypeSpecificInputs(type, substitutedComponent, props.tables)

  const finalElementPropsWithType = buildTypeSpecificElementProps(type, {
    baseElementPropsWithType,
    component: substitutedComponent,
    componentProps,
    resolved: resolvedTypeInputs,
    currentLang: props.currentLang,
    languages: props.languages,
  })

  const meta = componentProps?.meta as ComponentMeta | undefined
  const structuredDataScript = meta ? <StructuredDataFromComponent meta={meta} /> : undefined

  if (hasResponsiveContentOverrides(responsive)) {
    return renderWithResponsiveContent({
      responsive,
      type,
      finalElementPropsWithType,
      finalElementPropsWithSpacingAndType,
      hoverData,
      component: substitutedComponent,
    })
  }

  const finalRenderedChildren = hasResponsiveChildrenOverrides(responsive)
    ? buildResponsiveChildren(responsive, baseRenderedChildren, props)
    : baseRenderedChildren

  const finalChildren = structuredDataScript
    ? ([structuredDataScript, ...finalRenderedChildren] as readonly ReactElement[])
    : finalRenderedChildren

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
    currentLang: props.currentLang,
    interactions,
    action: substitutedComponent.action,
    component: substitutedComponent,
    rawProps: mergedPropsWithVisibility as Record<string, unknown> | undefined,
    tables: props.tables,
    buckets: props.buckets,
    landingPath: props.landingPath,
    routeParams: props.routeParams,
    session: props.session,
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

export function ComponentRenderer(props: ComponentRendererProps): Readonly<ReactElement | null> {
  const { component } = props

  if ('component' in component || '$ref' in component) {
    return renderComponentReference(component, props)
  }

  return (
    <RenderDirectComponent
      component={component as Component}
      props={props}
    />
  )
}
