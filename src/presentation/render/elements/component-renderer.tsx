/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment, useId } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { resolveComponentStyle } from '@/presentation/design/resolve-component-classes'
import {
  StructuredDataFromComponent,
  type ComponentMeta,
} from '@/presentation/render/page/structured-data-from-component'
import { useBreakpoint } from '@/presentation/render/props/use-breakpoint'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { resolveI18nContent } from '../i18n/i18n-content-resolver'
import {
  resolveChildTranslation,
  resolveComponentTranslationTokens,
} from '../i18n/translation-handler'
import {
  substituteVariableValues,
  substitutePropsVariables,
  substituteChildrenVariables,
} from '../i18n/variable-substitution'
import { buildComponentProps } from '../props/component-builder'
import { buildResponsiveChildrenVariants } from '../props/responsive-children-builder'
import { buildResponsiveContentVariants } from '../props/responsive-content-builder'
import { mergeResponsiveProps } from '../props/responsive-props-merger'
import {
  buildTypeSpecificElementProps,
  resolveTypeSpecificInputs,
} from '../props/type-specific-props-builder'
import {
  extractComponentReference,
  renderComponentReferenceError,
} from '../registry/component-reference-handler'
import { resolveComponent } from '../registry/component-resolution'
import { dispatchComponentType } from '../registry/component-type-dispatcher'
import { buildInteractionProps } from '../styling/interaction-props-builder'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Component, ComponentType } from '@/domain/models/app/pages/components'
import type { VariantOverrides } from '@/domain/models/app/pages/components/responsive'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Component renderer props
 */
type ComponentRendererProps = {
  readonly component: Component | SimpleComponentReference | ComponentReference
  readonly pageVars?: Record<string, string | number | boolean>
  readonly componentName?: string
  readonly componentInstanceIndex?: number
  readonly components?: Components
  /**
   * App-level `design` key. Threaded on the same
   * channel as `design` — it is app-wide render context, not per-component data
   * — so `design.components[<type>]` can be resolved once per component
   * instance and folded into its class list at the right precedence layer.
   */
  readonly design?: Design
  readonly languages?: Languages
  readonly currentLang?: string
  readonly childIndex?: number
  readonly tables?: Tables
  readonly buckets?: Buckets
  /**
   * App-level `auth.landingPath`. Forwarded
   * to the dispatcher so the embedded auth form resolves an
   * `onSuccess.type=role-landing` redirect target.
   */
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  readonly session?: SessionInfo
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
      design={props.design}
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
        design={props.design}
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
 * What this component's children are, for the ONE type whose child is not in
 * `children`.
 *
 * A `specimen` draws the component held in its `component` field, and that
 * field has to reach the SAME pipeline a child does — variable substitution,
 * the `design.components` cascade, the recipe, the floor — or the drawn thing
 * would be a different element from the one the rest of the app renders, and
 * the provenance badges beside it would describe something that is not on
 * screen. Routing it through `children` is how it gets all of that for free.
 *
 * It is a substitution and not an append: `specimen` declares no `children` of
 * its own (the union injects `children` into containers only), so there is
 * nothing here to displace.
 *
 * `preview` is the SECOND such type and reaches the same line deliberately. It
 * draws the catalogue's own specimen for a type with one option applied, and the
 * whole claim of [internal ref] is that the drawing goes through the path a `specimen`
 * takes — so a type that draws in the kit draws here, and one that refuses
 * refuses here with the same sentence. A parallel route would be a second
 * pipeline the two could drift apart in.
 */
function childrenToRender(
  type: ComponentType,
  component: Component,
  mergedChildren: ReadonlyArray<Component | string> | undefined
): ReadonlyArray<Component | string> | undefined {
  if (type !== 'specimen' && type !== 'preview') return mergedChildren
  const drawn = (component as { component?: Component }).component
  return drawn === undefined ? mergedChildren : [drawn]
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
  type: ComponentType
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
              // The responsive visibility class is a FLOOR, not a default: it
              // is what makes this breakpoint variant appear at the right
              // width, so an author `className` must not be able to drop it.
              className: resolveClasses(
                '',
                undefined,
                (child.props as { className?: string } | undefined)?.className,
                additionalClassName
              ),
            } as Record<string, unknown>,
          }
        : child

      return (
        <ComponentRenderer
          key={`${breakpoint}-${index}`}
          component={childWithVisibility}
          pageVars={props.pageVars}
          components={props.components}
          design={props.design}
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
  // Apply page-level variable substitution if pageVars are provided, then
  // resolve the `$t:` tokens in the component's own schema-level fields. That
  // second pass is what reaches a field NO lift copies onto the element props —
  // a `graph` or `matrix` `label` / `emptyMessage`, which their renderers read
  // straight off the component below. See `resolveComponentTranslationTokens`
  // for the keys it deliberately leaves alone — `content` and `children` above
  // all, whose RAW token the language switcher still needs.
  const substitutedComponent = resolveComponentTranslationTokens(
    applyVariableSubstitution(component, props.pageVars),
    props.currentLang,
    props.languages
  )

  const {
    type,
    props: componentProps,
    children,
    content,
    interactions: topLevelInteractions,
    i18n,
    responsive,
  } = substitutedComponent
  // Support interactions from both top-level field and inside props
  const interactions =
    topLevelInteractions ?? (componentProps?.interactions as typeof topLevelInteractions)
  const uniqueId = useId()
  const currentBreakpoint = useBreakpoint()

  // Merge responsive props using extracted module
  const {
    mergedProps: mergedPropsWithVisibility,
    mergedChildren,
    mergedContent,
  } = mergeResponsiveProps(responsive, componentProps, children, content, currentBreakpoint)

  // `design.components[<type>]`, resolved ONCE per component instance against
  // this instance's variant. Two consumers: `buildFinalClassName`, which folds
  // the root part and the floor into `className` at the right precedence layer,
  // and the dispatch config, which carries `replace` + the non-root parts to
  // the renderers that own a recipe or an island.
  const designStyles = resolveComponentStyle(
    props.design,
    type,
    (substitutedComponent as { variant?: string }).variant
  )

  const { elementProps, elementPropsWithSpacing } = buildComponentProps({
    type,
    props: mergedPropsWithVisibility,
    children: mergedChildren,
    content: typeof mergedContent === 'string' ? mergedContent : undefined,
    componentName: props.componentName,
    componentInstanceIndex: props.componentInstanceIndex,
    languages: props.languages,
    currentLang: props.currentLang,
    childIndex: props.childIndex,
    interactions,
    variant: (substitutedComponent as { variant?: string }).variant,
    size: (substitutedComponent as { size?: string }).size,
    badgeVariant: (substitutedComponent as { badgeVariant?: string }).badgeVariant,
    designStyles,
    design: props.design,
  })

  // Build interaction props using extracted module
  const {
    finalElementProps: interactionElementProps,
    finalElementPropsWithSpacing: interactionElementPropsWithSpacing,
    hoverData,
  } = buildInteractionProps(interactions, uniqueId, elementProps, elementPropsWithSpacing)

  const baseRenderedChildren = renderChildren(
    childrenToRender(type, substitutedComponent, mergedChildren),
    props
  )

  // Resolve i18n content using extracted module
  const { resolvedContent, finalElementProps, finalElementPropsWithSpacing } = resolveI18nContent({
    content: mergedContent,
    i18n,
    currentLang: props.currentLang,
    languages: props.languages,
    elementProps: interactionElementProps,
    elementPropsWithSpacing: interactionElementPropsWithSpacing,
  })

  // Add data-component-type attribute for testing
  const baseElementPropsWithType = addComponentTypeAttribute(finalElementProps, type)
  const finalElementPropsWithSpacingAndType = addComponentTypeAttribute(
    finalElementPropsWithSpacing,
    type
  )

  // Inject island-specific props for data-table / kanban sections. These
  // properties live on the Component object (not in component.props) and need
  // to be forwarded to the island placeholder renderer. The per-type inputs
  // (field names, field metadata, permissions, normalised views, kanban column
  // options) are resolved from `app.tables`; see `resolveTypeSpecificInputs`.
  const resolvedTypeInputs = resolveTypeSpecificInputs(type, substitutedComponent, props.tables)

  // Build the type-specific element props forwarded to the island/component
  // renderer (keyed dispatch per component `type`; non-data types pass through
  // the base element props unchanged). See `buildTypeSpecificElementProps`.
  const finalElementPropsWithType = buildTypeSpecificElementProps(type, {
    baseElementPropsWithType,
    component: substitutedComponent,
    componentProps,
    resolved: resolvedTypeInputs,
    currentLang: props.currentLang,
    languages: props.languages,
  })

  // Check if component has meta property with structured data.
  // The `key` is load-bearing, not decoration: this element is spread into the
  // children ARRAY below, and React requires a key on every child of a list.
  // It must not collide with the keys the sibling children already carry —
  // `renderChildren` keys by numeric index and `buildResponsiveChildren` by
  // `<breakpoint>-<index>`, so a non-numeric literal is collision-free.
  const meta = componentProps?.meta as ComponentMeta | undefined
  const structuredDataScript = meta ? (
    <StructuredDataFromComponent
      key="structured-data"
      meta={meta}
    />
  ) : undefined

  // Check if component has responsive content overrides
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
    designStyles,
    // The key itself, beside the resolution of it — see `ComponentDispatchConfig`
    // for the two design-console components that need the unresolved form.
    design: props.design,
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
 * Supports component references for reusable components and design token substitution.
 *
 * @param props - Component props
 * @param props.component - Component configuration from sections schema (can be a direct component or component reference)
 * @param props.componentName - Optional component template name for data-component attribute
 * @param props.componentInstanceIndex - Optional instance index for components used multiple times (for unique data-testid)
 * @param props.components - Optional components array for resolving component references
 * @param props.design - Optional design configuration for token substitution
 * @param props.languages - Optional languages configuration for language-switcher components
 * @param props.currentLang - Current page language (defaults to languages.default)
 * @returns React element matching the component type
 */
export function ComponentRenderer(props: ComponentRendererProps): Readonly<ReactElement | null> {
  const { component } = props

  // Handle component references - supports both { component: 'name' } and { $ref: 'name' } syntaxes.
  //
  // Keyed on the VALUE being a string, not on the key being present. A
  // reference names a template (`SimpleComponentReference.component: string`),
  // and one page component now declares a `component` field of its own holding
  // a whole COMPONENT: `specimen`, which draws it. Testing for the key alone
  // routed every specimen into the reference resolver, which looked up a
  // template named `[object Object]`, warned `Component not found`, and drew a
  // red error box where the drawing should be.
  if (isComponentReferenceNode(component)) {
    return renderComponentReference(
      component as SimpleComponentReference | ComponentReference,
      props
    )
  }

  // Direct component rendering
  return (
    <RenderDirectComponent
      component={component as Component}
      props={props}
    />
  )
}
