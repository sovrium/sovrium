/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
import type { RouteParams } from '@/domain/utils/route-matcher'

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
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly routeParams?: RouteParams
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
      tables={props.tables}
      buckets={props.buckets}
      routeParams={props.routeParams}
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
        tables={props.tables}
        buckets={props.buckets}
        routeParams={props.routeParams}
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
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Island prop injection adds one branch; pre-existing complexity slated for split with the renderer pipeline refactor
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
  const baseElementPropsWithType = addComponentTypeAttribute(finalElementProps, type)
  const finalElementPropsWithSpacingAndType = addComponentTypeAttribute(
    finalElementPropsWithSpacing,
    type
  )

  // Inject island-specific props for data-table sections
  // These properties live on the Component object (not in component.props)
  // and need to be forwarded to the island placeholder renderer
  // Resolve table field names from app.tables for auto-column generation
  const dataTableResolvedTable =
    type === 'data-table' && props.tables && substitutedComponent.dataSource
      ? props.tables.find(
          (t) => t.name === (substitutedComponent.dataSource as { readonly table: string }).table
        )
      : undefined

  const dataTableTableFields = dataTableResolvedTable
    ? dataTableResolvedTable.fields.map((f) => f.name)
    : undefined

  // Extract field metadata (type + options) for inline editing field-type-aware editors
  const dataTableFieldMeta = dataTableResolvedTable
    ? Object.fromEntries(
        dataTableResolvedTable.fields.map((f) => [
          f.name,
          {
            type: f.type,
            ...('options' in f && f.options ? { options: f.options } : {}),
            ...('required' in f && f.required ? { required: true } : {}),
          },
        ])
      )
    : undefined

  // Resolve table-level permissions for inline editing
  const dataTablePermissions = dataTableResolvedTable?.permissions

  // Resolve kanban groupBy field options from app.tables so empty columns
  // (defined by select/status options but unused in the data) still render.
  const kanbanResolvedTable =
    type === 'kanban' && props.tables && substitutedComponent.dataSource
      ? props.tables.find(
          (t) => t.name === (substitutedComponent.dataSource as { readonly table: string }).table
        )
      : undefined

  const kanbanGroupByField = (substitutedComponent as { kanbanGroupBy?: { field?: string } })
    .kanbanGroupBy?.field

  const kanbanColumnOptions =
    kanbanResolvedTable && kanbanGroupByField
      ? (() => {
          const groupField = kanbanResolvedTable.fields.find((f) => f.name === kanbanGroupByField)
          if (groupField && 'options' in groupField && Array.isArray(groupField.options)) {
            return groupField.options as readonly string[]
          }
          return undefined
        })()
      : undefined

  const finalElementPropsWithType =
    type === 'data-table'
      ? {
          ...baseElementPropsWithType,
          dataSource: substitutedComponent.dataSource,
          columns: substitutedComponent.columns,
          selection: substitutedComponent.selection,
          pagination: substitutedComponent.pagination,
          search: substitutedComponent.search,
          groupBy: substitutedComponent.groupBy,
          summary: substitutedComponent.summary,
          toolbar: substitutedComponent.toolbar,
          bulkActions: substitutedComponent.bulkActions,
          rowHeight: substitutedComponent.rowHeight,
          striped: substitutedComponent.striped,
          bordered: substitutedComponent.bordered,
          emptyMessage: substitutedComponent.emptyMessage,
          showRowNumbers: substitutedComponent.showRowNumbers,
          onRowClick: substitutedComponent.onRowClick,
          tableFields: dataTableTableFields,
          fieldMeta: dataTableFieldMeta,
          tablePermissions: dataTablePermissions,
        }
      : type === 'kanban'
        ? {
            ...baseElementPropsWithType,
            dataSource: substitutedComponent.dataSource,
            kanbanGroupBy: substitutedComponent.kanbanGroupBy,
            card: substitutedComponent.card,
            drag: substitutedComponent.drag,
            emptyColumnMessage: substitutedComponent.emptyColumnMessage,
            colorField: substitutedComponent.colorField,
            columnOptions: kanbanColumnOptions,
          }
        : type === 'calendar'
          ? {
              ...baseElementPropsWithType,
              dataSource: substitutedComponent.dataSource,
              dateField: substitutedComponent.dateField,
              endDateField: substitutedComponent.endDateField,
              defaultView: substitutedComponent.defaultView,
              labelField: substitutedComponent.labelField,
              colorField: substitutedComponent.colorField,
              maxEventsPerDay: substitutedComponent.maxEventsPerDay,
              calendarEvent: substitutedComponent.calendarEvent,
              calendarInteraction: substitutedComponent.calendarInteraction,
            }
          : type === 'gallery'
            ? {
                ...baseElementPropsWithType,
                dataSource: substitutedComponent.dataSource,
                gridColumns: substitutedComponent.gridColumns,
                galleryCard: substitutedComponent.galleryCard,
                emptyMessage: substitutedComponent.emptyMessage,
                layout: substitutedComponent.layout,
              }
            : type === 'chart'
              ? {
                  ...baseElementPropsWithType,
                  dataSource: substitutedComponent.dataSource,
                  chartType: substitutedComponent.chartType,
                  xAxis: substitutedComponent.xAxis,
                  yAxis: substitutedComponent.yAxis,
                  series: substitutedComponent.series,
                  legend: substitutedComponent.legend,
                  tooltip: substitutedComponent.tooltip,
                  chartAggregate: substitutedComponent.chartAggregate,
                  emptyMessage: substitutedComponent.emptyMessage,
                }
              : type === 'select'
                ? {
                    ...baseElementPropsWithType,
                    dataSource: substitutedComponent.dataSource,
                    valueField: substitutedComponent.valueField,
                    displayField: substitutedComponent.displayField,
                  }
                : type === 'modal'
                  ? {
                      ...baseElementPropsWithType,
                      id: substitutedComponent.id,
                      title: substitutedComponent.title,
                      sections: substitutedComponent.sections,
                    }
                  : type === 'input'
                    ? {
                        ...baseElementPropsWithType,
                        ...((substitutedComponent as { inputType?: string }).inputType !==
                          undefined && {
                          type: (substitutedComponent as { inputType?: string }).inputType,
                        }),
                      }
                    : baseElementPropsWithType

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
    theme: props.theme,
    languages: props.languages,
    interactions,
    action: substitutedComponent.action,
    component: substitutedComponent,
    rawProps: mergedPropsWithVisibility as Record<string, unknown> | undefined,
    tables: props.tables,
    buckets: props.buckets,
    routeParams: props.routeParams,
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
