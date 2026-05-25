/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { renderStatusBadge } from '../../renderers/element-renderers/html-element-renderer'
import { convertBadgeProps } from '../component-registry-helpers'
import { pickCompField } from './island-overlay-props-builders'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

function resolveStatusDotColorClass(value: unknown): string {
  switch (value) {
    case 'green':
      return 'bg-success-solid'
    case 'red':
      return 'bg-error-solid'
    case 'amber':
    case 'yellow':
      return 'bg-warning-solid'
    case 'blue':
      return 'bg-info-solid'
    case 'gray':
    default:
      return 'bg-neutral-600'
  }
}

function overlayButtonSchemaFallbacks(
  elementProps: Record<string, unknown>,
  componentRaw: Record<string, unknown>
): Record<string, unknown> {
  const topLabel =
    typeof componentRaw['label'] === 'string' ? (componentRaw['label'] as string) : undefined
  const topConfirm =
    typeof componentRaw['confirm'] === 'string' ? (componentRaw['confirm'] as string) : undefined
  return {
    ...elementProps,
    ...(topLabel !== undefined && elementProps.label === undefined ? { label: topLabel } : {}),
    ...(topConfirm !== undefined && elementProps['data-confirm'] === undefined
      ? { 'data-confirm': topConfirm }
      : {}),
  }
}

function buildButtonClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const variant = componentRaw['variant'] as string | undefined
  const size = componentRaw['size'] as string | undefined
  const variantClass = variant && variant !== 'default' ? `btn-${variant}` : ''
  const sizeClass = size && size !== 'md' ? `btn-${size}` : ''
  const btnClasses = ['btn', variantClass, sizeClass].filter(Boolean).join(' ')
  return authorClassName ? `${btnClasses} ${authorClassName}` : btnClasses
}

export const interactiveComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  button: ({
    elementProps,
    content,
    renderedChildren,
    interactions,
    action,
    tables,
    routeParams,
    component,
  }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const propsWithSchemaFallbacks = overlayButtonSchemaFallbacks(elementProps, c)
    const mergedClassName = buildButtonClassName(
      c,
      propsWithSchemaFallbacks.className as string | undefined
    )
    const loading = c['loading'] as boolean | undefined

    return Renderers.renderButton({
      props: { ...propsWithSchemaFallbacks, className: mergedClassName },
      content,
      children: renderedChildren,
      interactions,
      action,
      tables,
      routeParams,
      loading,
    })
  },

  link: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderLink(elementProps, content, renderedChildren),

  alert: ({ elementProps, content, renderedChildren, theme }) =>
    Renderers.renderAlert(elementProps, content, renderedChildren, theme),

  form: ({ elementProps, renderedChildren, action, tables, buckets, component }) =>
    Renderers.renderForm({
      props: elementProps,
      children: renderedChildren,
      action,
      tables,
      buckets,
      component,
    }),

  input: ({ elementProps }) => Renderers.renderInput(elementProps),


  'time-picker': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const timeFormat = c['timeFormat'] as string | undefined
    const minTime = c['minTime'] as string | undefined
    const maxTime = c['maxTime'] as string | undefined
    const minuteStep = c['minuteStep'] as number | undefined
    const label = rawProps?.['label'] as string | undefined
    const stepSeconds = typeof minuteStep === 'number' ? minuteStep * 60 : undefined
    return Renderers.renderTimePicker({
      props: elementProps,
      label,
      timeFormat,
      minTime,
      maxTime,
      stepSeconds,
    })
  },

  'date-picker': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const dateFormat = c['dateFormat'] as string | undefined
    const minDate = c['minDate'] as string | undefined
    const maxDate = c['maxDate'] as string | undefined
    const datePickerMode = c['datePickerMode'] as 'single' | 'range' | undefined
    const label = rawProps?.['label'] as string | undefined
    const placeholder = rawProps?.['placeholder'] as string | undefined
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const name = rawProps?.['name'] as string | undefined
    const islandProps = {
      id: elementProps.id as string | undefined,
      label,
      placeholder,
      dateFormat,
      minDate,
      maxDate,
      datePickerMode,
      disabled,
      name,
    }
    return Renderers.renderDatePickerIsland({
      props: elementProps,
      islandProps,
      label,
      placeholder,
      disabled,
    })
  },

  'number-input': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const min = c['min'] as number | undefined
    const max = c['max'] as number | undefined
    const step = c['step'] as number | undefined
    const defaultValue = c['defaultValue'] as number | undefined
    const showStepper = c['showStepper'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const name = rawProps?.['name'] as string | undefined
    const islandProps = {
      id: elementProps.id as string | undefined,
      label,
      min,
      max,
      step,
      defaultValue,
      showStepper,
      disabled,
      name,
    }
    return Renderers.renderNumberInputIsland({
      props: elementProps,
      islandProps,
      label,
      min,
      max,
      step,
      defaultValue,
      showStepper,
    })
  },

  textarea: ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const rows = c['rows'] as number | undefined
    const maxLength = c['maxLength'] as number | undefined
    const autoResize = c['autoResize'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined

    return Renderers.renderTextarea({
      props: elementProps,
      rows,
      maxLength,
      label,
      autoResize,
      placeholder: rawProps?.['placeholder'] as string | undefined,
      name: rawProps?.['name'] as string | undefined,
    })
  },

  field: ({ elementProps, component, renderedChildren }) => {
    const c = (component ?? {}) as Record<string, unknown>
    return Renderers.renderField({
      props: elementProps,
      fieldLabel: c['fieldLabel'] as string | undefined,
      fieldDescription: c['fieldDescription'] as string | undefined,
      fieldError: c['fieldError'] as string | undefined,
      required: c['required'] as boolean | undefined,
      controlId: Renderers.extractFirstChildId(component),
      children: renderedChildren,
    })
  },

  'file-upload': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const accept = pickCompField<string>(c, rawProps, 'accept')
    const maxFiles = pickCompField<number>(c, rawProps, 'maxFiles')
    const dropZone = pickCompField<boolean>(c, rawProps, 'dropZone')
    const maxFileSize = pickCompField<number>(c, rawProps, 'maxFileSize')
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined

    if (dropZone === true) {
      const islandProps = {
        accept,
        maxFiles,
        maxFileSize,
        dropZone,
        disabled,
        label,
        id: elementProps.id as string | undefined,
        className: elementProps.className as string | undefined,
        'data-testid': elementProps['data-testid'] as string | undefined,
      }
      return Renderers.renderFileUploadIsland({
        props: elementProps,
        islandProps,
        accept,
        maxFiles,
        dropZone,
        disabled,
        label,
      })
    }

    return Renderers.renderFileUpload({
      props: elementProps,
      accept,
      maxFiles,
      dropZone,
      disabled,
      label,
    })
  },

  icon: ({ elementProps, renderedChildren }) =>
    Renderers.renderIcon(elementProps, renderedChildren),

  badge: ({ elementProps, content, renderedChildren, interactions, component }) => {
    const badgeProps = convertBadgeProps(elementProps)

    const variant = (component as { variant?: unknown } | undefined)?.variant
    if (variant === 'status') {
      const status = (component as { status?: unknown } | undefined)?.status
      const statusColor = (component as { statusColor?: unknown } | undefined)?.statusColor
      const pulse = (component as { pulse?: unknown } | undefined)?.pulse === true
      const dotColorClass = resolveStatusDotColorClass(statusColor)
      const dotClassName = pulse
        ? `inline-block h-2 w-2 rounded-full ${dotColorClass} animate-pulse`
        : `inline-block h-2 w-2 rounded-full ${dotColorClass}`
      const statusLabel = typeof status === 'string' ? status : undefined
      return renderStatusBadge({
        props: badgeProps,
        dotClassName,
        label: statusLabel,
      })
    }

    return Renderers.renderHTMLElement({
      type: 'span',
      props: badgeProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  customHTML: ({ elementProps, content, component }) => {
    const trustedContent = (component as { trustedContent?: unknown } | undefined)?.trustedContent
    if (typeof trustedContent === 'string') {
      return Renderers.renderCustomHTML(elementProps, trustedContent, true)
    }
    return Renderers.renderCustomHTML(elementProps, content)
  },

  'language-switcher': ({ elementProps, languages }) =>
    Renderers.renderLanguageSwitcher(elementProps, languages),

  searchInput: ({ elementProps }) => Renderers.renderSearchInput(elementProps),
}
